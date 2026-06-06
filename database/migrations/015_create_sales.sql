CREATE TABLE tbl_sales (
    id_sale UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    sale_number VARCHAR(50) NOT NULL UNIQUE,

    id_member UUID,
    id_cashier UUID NOT NULL,

    customer_type VARCHAR(20) NOT NULL DEFAULT 'GENERAL',

    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,

    payment_method VARCHAR(30) NOT NULL,
    amount_paid NUMERIC(15, 2) NOT NULL DEFAULT 0,
    change_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,

    sale_date TIMESTAMP NOT NULL DEFAULT NOW(),

    notes TEXT,

    is_active CHAR(1) NOT NULL DEFAULT 'Y',

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT fk_sales_member
        FOREIGN KEY (id_member)
        REFERENCES tbl_members(id_member),

    CONSTRAINT fk_sales_cashier
        FOREIGN KEY (id_cashier)
        REFERENCES tbl_users(id_user),

    CONSTRAINT fk_sales_created_by
        FOREIGN KEY (created_by)
        REFERENCES tbl_users(id_user),

    CONSTRAINT chk_sales_customer_type
        CHECK (customer_type IN ('GENERAL', 'MEMBER')),

    CONSTRAINT chk_sales_payment_method
        CHECK (payment_method IN ('CASH', 'QRIS')),

    CONSTRAINT chk_sales_subtotal
        CHECK (subtotal >= 0),

    CONSTRAINT chk_sales_discount
        CHECK (discount_amount >= 0),

    CONSTRAINT chk_sales_total
        CHECK (total_amount >= 0),

    CONSTRAINT chk_sales_amount_paid
        CHECK (amount_paid >= 0),

    CONSTRAINT chk_sales_change
        CHECK (change_amount >= 0),

    CONSTRAINT chk_sales_is_active
        CHECK (is_active IN ('Y', 'N'))
);
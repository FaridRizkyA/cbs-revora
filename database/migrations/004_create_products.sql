CREATE TABLE tbl_products (
    id_product UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    product_code VARCHAR(50) NOT NULL UNIQUE,
    product_name VARCHAR(150) NOT NULL,
    description TEXT,

    selling_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    minimum_stock INTEGER NOT NULL DEFAULT 0,

    product_image TEXT,

    is_active CHAR(1) NOT NULL DEFAULT 'Y',

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT chk_products_selling_price
        CHECK (selling_price >= 0),

    CONSTRAINT chk_products_minimum_stock
        CHECK (minimum_stock >= 0),

    CONSTRAINT chk_products_is_active
        CHECK (is_active IN ('Y', 'N'))
);
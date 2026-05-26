CREATE TABLE IF NOT EXISTS tbl_suppliers (
    id_supplier UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    supplier_code VARCHAR(50) NOT NULL UNIQUE,
    supplier_name VARCHAR(150) NOT NULL,
    city VARCHAR(100),
    phone_number VARCHAR(30),

    is_active CHAR(1) NOT NULL DEFAULT 'Y',

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT chk_Suppliers_is_active
        CHECK (is_active IN ('Y', 'N'))
);


CREATE TABLE tbl_inventory_units (
    id_inventory_unit UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    id_product UUID NOT NULL,
    id_product_batch UUID NOT NULL,

    barcode VARCHAR(100) NOT NULL UNIQUE,

    unit_status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
    sold_date TIMESTAMP,

    is_active CHAR(1) NOT NULL DEFAULT 'Y',

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT fk_inventory_units_product
        FOREIGN KEY (id_product)
        REFERENCES tbl_products(id_product),

    CONSTRAINT fk_inventory_units_product_batch
        FOREIGN KEY (id_product_batch)
        REFERENCES tbl_product_batches(id_product_batch),

    CONSTRAINT chk_inventory_units_status
        CHECK (unit_status IN ('AVAILABLE', 'SOLD', 'DAMAGED', 'EXPIRED', 'LOST')),

    CONSTRAINT chk_inventory_units_is_active
        CHECK (is_active IN ('Y', 'N'))
);
CREATE TABLE tbl_sale_items (
    id_sale_item UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    id_sale UUID NOT NULL,
    id_product UUID NOT NULL,
    id_product_batch UUID,
    id_inventory_unit UUID,

    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,

    is_active CHAR(1) NOT NULL DEFAULT 'Y',

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT fk_sale_items_sale
        FOREIGN KEY (id_sale)
        REFERENCES tbl_sales(id_sale),

    CONSTRAINT fk_sale_items_product
        FOREIGN KEY (id_product)
        REFERENCES tbl_products(id_product),

    CONSTRAINT fk_sale_items_product_batch
        FOREIGN KEY (id_product_batch)
        REFERENCES tbl_product_batches(id_product_batch),

    CONSTRAINT fk_sale_items_inventory_unit
        FOREIGN KEY (id_inventory_unit)
        REFERENCES tbl_inventory_units(id_inventory_unit),

    CONSTRAINT chk_sale_items_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_sale_items_unit_price
        CHECK (unit_price >= 0),

    CONSTRAINT chk_sale_items_subtotal
        CHECK (subtotal >= 0),

    CONSTRAINT chk_sale_items_is_active
        CHECK (is_active IN ('Y', 'N'))
);
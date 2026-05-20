CREATE TABLE tbl_stock_movements (
    id_stock_movement UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    id_product UUID NOT NULL,
    id_product_batch UUID,
    id_inventory_unit UUID,

    movement_type VARCHAR(30) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,

    reason TEXT,
    notes TEXT,

    movement_date TIMESTAMP NOT NULL DEFAULT NOW(),

    is_active CHAR(1) NOT NULL DEFAULT 'Y',

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT fk_stock_movements_product
        FOREIGN KEY (id_product)
        REFERENCES tbl_products(id_product),

    CONSTRAINT fk_stock_movements_product_batch
        FOREIGN KEY (id_product_batch)
        REFERENCES tbl_product_batches(id_product_batch),

    CONSTRAINT fk_stock_movements_inventory_unit
        FOREIGN KEY (id_inventory_unit)
        REFERENCES tbl_inventory_units(id_inventory_unit),

    CONSTRAINT fk_stock_movements_created_by
        FOREIGN KEY (created_by)
        REFERENCES tbl_users(id_user),

    CONSTRAINT chk_stock_movements_type
        CHECK (movement_type IN ('IN', 'OUT', 'ADJUSTMENT')),

    CONSTRAINT chk_stock_movements_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_stock_movements_is_active
        CHECK (is_active IN ('Y', 'N')),

    CONSTRAINT chk_stock_movements_adjustment_reason
        CHECK (
            movement_type <> 'ADJUSTMENT'
            OR reason IS NOT NULL
        )
);
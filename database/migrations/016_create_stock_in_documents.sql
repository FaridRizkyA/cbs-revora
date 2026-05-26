CREATE TABLE IF NOT EXISTS tbl_stock_in_headers (
    id_stock_in UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    stock_in_code VARCHAR(120) NOT NULL UNIQUE,
    id_supplier UUID NOT NULL,
    stock_in_date TIMESTAMP NOT NULL DEFAULT NOW(),
    notes TEXT,

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT fk_stock_in_headers_Supplier
        FOREIGN KEY (id_supplier)
        REFERENCES tbl_suppliers(id_supplier),

    CONSTRAINT fk_stock_in_headers_created_by
        FOREIGN KEY (created_by)
        REFERENCES tbl_users(id_user)
);

CREATE TABLE IF NOT EXISTS tbl_stock_in_items (
    id_stock_in_item UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    id_stock_in UUID NOT NULL,
    id_product UUID NOT NULL,
    id_product_batch UUID,

    quantity INTEGER NOT NULL DEFAULT 1,
    expired_date DATE NOT NULL,

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT fk_stock_in_items_header
        FOREIGN KEY (id_stock_in)
        REFERENCES tbl_stock_in_headers(id_stock_in),

    CONSTRAINT fk_stock_in_items_product
        FOREIGN KEY (id_product)
        REFERENCES tbl_products(id_product),

    CONSTRAINT fk_stock_in_items_batch
        FOREIGN KEY (id_product_batch)
        REFERENCES tbl_product_batches(id_product_batch),

    CONSTRAINT fk_stock_in_items_created_by
        FOREIGN KEY (created_by)
        REFERENCES tbl_users(id_user),

    CONSTRAINT chk_stock_in_items_quantity
        CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_stock_in_headers_created_date
    ON tbl_stock_in_headers(created_date DESC);

CREATE INDEX IF NOT EXISTS idx_stock_in_headers_Supplier
    ON tbl_stock_in_headers(id_supplier);

CREATE INDEX IF NOT EXISTS idx_stock_in_items_stock_in
    ON tbl_stock_in_items(id_stock_in);

CREATE INDEX IF NOT EXISTS idx_stock_in_items_product
    ON tbl_stock_in_items(id_product);



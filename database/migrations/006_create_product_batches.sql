CREATE TABLE tbl_product_batches (
    id_product_batch UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    id_product UUID NOT NULL,

    batch_code VARCHAR(100) NOT NULL,
    expired_date DATE NOT NULL,

    purchase_price NUMERIC(15, 2) NOT NULL DEFAULT 0,

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT fk_product_batches_product
        FOREIGN KEY (id_product)
        REFERENCES tbl_products(id_product),

    CONSTRAINT uq_product_batches_batch
        UNIQUE (id_product, batch_code),

    CONSTRAINT chk_product_batches_purchase_price
        CHECK (purchase_price >= 0)
);

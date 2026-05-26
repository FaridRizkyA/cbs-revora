ALTER TABLE tbl_stock_movements
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(40),
    ADD COLUMN IF NOT EXISTS source_id UUID,
    ADD COLUMN IF NOT EXISTS source_item_id UUID;

CREATE INDEX IF NOT EXISTS idx_stock_movements_source_type_id
    ON tbl_stock_movements(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_source_item_id
    ON tbl_stock_movements(source_item_id);


INSERT INTO tbl_stock_in_headers (
    id_stock_in,
    stock_in_code,
    id_supplier,
    stock_in_date,
    notes,
    created_date,
    created_by
) VALUES
    ('11111111-aaaa-4aaa-8aaa-111111111111', 'STI/20260102/00001', 'a77aa111-1111-4a77-8b11-111111111111', '2026-01-02 08:00:00', 'Seed stock in document for supplier A', '2026-01-02 08:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('22222222-bbbb-4bbb-8bbb-222222222222', 'STI/20260102/00002', 'b88bb222-2222-4b88-8c22-222222222222', '2026-01-02 08:00:00', 'Seed stock in document for supplier B', '2026-01-02 08:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('33333333-cccc-4ccc-8ccc-333333333333', 'STI/20260102/00003', 'c99cc333-3333-4c99-8d33-333333333333', '2026-01-02 08:00:00', 'Seed stock in document for supplier C', '2026-01-02 08:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('44444444-dddd-4ddd-8ddd-444444444444', 'STI/20260102/00004', 'd00dd444-4444-4d00-8e44-444444444444', '2026-01-02 08:00:00', 'Seed stock in document for supplier D', '2026-01-02 08:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10')
ON CONFLICT (id_stock_in) DO UPDATE SET
    stock_in_code = EXCLUDED.stock_in_code,
    id_supplier = EXCLUDED.id_supplier,
    stock_in_date = EXCLUDED.stock_in_date,
    notes = EXCLUDED.notes,
    created_by = EXCLUDED.created_by;



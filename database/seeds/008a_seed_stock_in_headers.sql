INSERT INTO tbl_stock_in_headers (
    id_stock_in,
    stock_in_code,
    id_supplier,
    stock_in_date,
    notes,
    created_date,
    created_by
) VALUES
    ('bd001e32-c262-4e28-bbfd-0b92bdbc4dbb', 'STI/20260102/00001', '293284a7-11b4-4035-97ad-cd699031d7d8', '2026-01-02 08:00:00', 'Seed stock in document for supplier A', '2026-01-02 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('df68a3b6-4895-4e6c-82e8-b8d4514bfa73', 'STI/20260102/00002', '8facb242-8306-450e-81c9-fdd5f94fe545', '2026-01-02 08:00:00', 'Seed stock in document for supplier B', '2026-01-02 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('b0630cc4-0c01-4af8-994d-60801b05d14c', 'STI/20260102/00003', '41c23d6b-8fd0-4c2f-a0bc-6d702db8d021', '2026-01-02 08:00:00', 'Seed stock in document for supplier C', '2026-01-02 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('7aeed67b-618f-49de-b061-7dd7d847c2bf', 'STI/20260102/00004', 'fc0d12c0-1a2a-4b20-984e-edd50c661a84', '2026-01-02 08:00:00', 'Seed stock in document for supplier D', '2026-01-02 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc')
ON CONFLICT (id_stock_in) DO UPDATE SET
    stock_in_code = EXCLUDED.stock_in_code,
    id_supplier = EXCLUDED.id_supplier,
    stock_in_date = EXCLUDED.stock_in_date,
    notes = EXCLUDED.notes,
    created_by = EXCLUDED.created_by;



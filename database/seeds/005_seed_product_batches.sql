INSERT INTO tbl_product_batches (
    id_product_batch,
    id_product,
    batch_code,
    expired_date,
    purchase_price,
    is_active,
    created_date,
    created_by
) VALUES
    ('b41507df-2869-4c41-9003-e2d4cfba0157', '8b2c7e46-9fd0-43b8-87e6-5f4b3c2d1e68', 'BATCH-UM-001', '2026-12-31', 5200.00, 'Y', '2026-01-02 08:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('c52618e0-397a-4d52-a114-f3e5d0cb1268', '9c3d8f57-a0e1-44c9-98f7-6a5c4d3e2f79', 'BATCH-IND-001', '2026-10-31', 3300.00, 'Y', '2026-01-02 08:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('d63729f1-4a8b-4e63-8225-a4f6e1dc2379', 'ad4e9068-b1f2-45da-89a8-7b6d5e4f3a80', 'BATCH-AQ-001', '2027-01-31', 3500.00, 'Y', '2026-01-02 08:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('e7483a02-5b9c-4f74-9336-b507f2ed348a', 'be5fa179-c203-46eb-9ab9-8c7e6f5a4b91', 'BATCH-TK-001', '2026-11-30', 4300.00, 'Y', '2026-01-02 08:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10')
ON CONFLICT (id_product, batch_code) DO UPDATE SET
    expired_date = EXCLUDED.expired_date,
    purchase_price = EXCLUDED.purchase_price,
    is_active = EXCLUDED.is_active,
    created_by = EXCLUDED.created_by;

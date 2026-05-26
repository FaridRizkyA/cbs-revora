INSERT INTO tbl_stock_in_items (
    id_stock_in_item,
    id_stock_in,
    id_product,
    id_product_batch,
    quantity,
    expired_date,
    created_date,
    created_by
) VALUES
    ('71111111-aaaa-4aaa-8aaa-111111111111', '11111111-aaaa-4aaa-8aaa-111111111111', '8b2c7e46-9fd0-43b8-87e6-5f4b3c2d1e68', 'b41507df-2869-4c41-9003-e2d4cfba0157', 25, '2026-12-31', '2026-01-02 08:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('72222222-aaaa-4aaa-8aaa-222222222222', '11111111-aaaa-4aaa-8aaa-111111111111', 'be5fa179-c203-46eb-9ab9-8c7e6f5a4b91', 'e7483a02-5b9c-4f74-9336-b507f2ed348a', 12, '2026-11-30', '2026-01-02 08:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('73333333-bbbb-4bbb-8bbb-333333333333', '22222222-bbbb-4bbb-8bbb-222222222222', '9c3d8f57-a0e1-44c9-98f7-6a5c4d3e2f79', 'c52618e0-397a-4d52-a114-f3e5d0cb1268', 20, '2026-10-31', '2026-01-02 08:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('74444444-bbbb-4bbb-8bbb-444444444444', '22222222-bbbb-4bbb-8bbb-222222222222', 'ad4e9068-b1f2-45da-89a8-7b6d5e4f3a80', 'd63729f1-4a8b-4e63-8225-a4f6e1dc2379', 15, '2027-01-31', '2026-01-02 08:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('75555555-cccc-4ccc-8ccc-555555555555', '33333333-cccc-4ccc-8ccc-333333333333', 'cf60b28a-d314-47fc-8bca-9d8f7a6b5c02', 'f8594b13-6cad-4085-a447-c61803fe459b', 5, '2026-02-15', '2026-01-02 08:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('76666666-cccc-4ccc-8ccc-666666666666', '33333333-cccc-4ccc-8ccc-333333333333', 'd071c39b-e425-480d-9cdb-ae908b7c6d13', 'a96a5c24-7dbe-4196-8558-d72914af560c', 8, '2026-02-15', '2026-01-02 08:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('77777777-dddd-4ddd-8ddd-777777777777', '44444444-dddd-4ddd-8ddd-444444444444', 'e182d4ac-f536-491e-ade0-bfa19c8d7e24', 'ba7b6d35-8ecf-42a7-9669-e83a25b0671d', 20, '2027-12-31', '2026-01-02 08:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('78888888-dddd-4ddd-8ddd-888888888888', '44444444-dddd-4ddd-8ddd-444444444444', 'f293e5bd-0647-4a2f-8ef1-c0b2ad9e8f35', 'cb8c7e46-9fd0-43b8-a77a-f94b36c1782e', 20, '2027-12-31', '2026-01-02 08:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10')
ON CONFLICT (id_stock_in_item) DO UPDATE SET
    id_stock_in = EXCLUDED.id_stock_in,
    id_product = EXCLUDED.id_product,
    id_product_batch = EXCLUDED.id_product_batch,
    quantity = EXCLUDED.quantity,
    expired_date = EXCLUDED.expired_date,
    created_by = EXCLUDED.created_by;


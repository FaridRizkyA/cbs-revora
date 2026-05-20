INSERT INTO tbl_inventory_units (
    id_inventory_unit,
    id_product,
    id_product_batch,
    barcode,
    unit_status,
    is_active,
    created_date,
    created_by
) VALUES
    ('f8594b13-6cad-4085-a447-c61803fe459b', '8b2c7e46-9fd0-43b8-87e6-5f4b3c2d1e68', 'b41507df-2869-4c41-9003-e2d4cfba0157', 'UM2500001', 'AVAILABLE', 'Y', '2026-01-02 08:10:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('a96a5c24-7dbe-4196-8558-d72914af560c', '8b2c7e46-9fd0-43b8-87e6-5f4b3c2d1e68', 'b41507df-2869-4c41-9003-e2d4cfba0157', 'UM2500002', 'AVAILABLE', 'Y', '2026-01-02 08:10:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('ba7b6d35-8ecf-42a7-9669-e83a25b0671d', '8b2c7e46-9fd0-43b8-87e6-5f4b3c2d1e68', 'b41507df-2869-4c41-9003-e2d4cfba0157', 'UM2500003', 'AVAILABLE', 'Y', '2026-01-02 08:10:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('cb8c7e46-9fd0-43b8-a77a-f94b36c1782e', '9c3d8f57-a0e1-44c9-98f7-6a5c4d3e2f79', 'c52618e0-397a-4d52-a114-f3e5d0cb1268', 'IND0001', 'AVAILABLE', 'Y', '2026-01-02 08:10:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('dc9d8f57-a0e1-44c9-886b-0a5c47d2893f', '9c3d8f57-a0e1-44c9-98f7-6a5c4d3e2f79', 'c52618e0-397a-4d52-a114-f3e5d0cb1268', 'IND0002', 'AVAILABLE', 'Y', '2026-01-02 08:10:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('edad9068-b1f2-45da-997c-1b6d58e39a40', '9c3d8f57-a0e1-44c9-98f7-6a5c4d3e2f79', 'c52618e0-397a-4d52-a114-f3e5d0cb1268', 'IND0003', 'AVAILABLE', 'Y', '2026-01-02 08:10:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('febe0179-c203-46eb-a88d-2c7e69f4ab51', 'ad4e9068-b1f2-45da-89a8-7b6d5e4f3a80', 'd63729f1-4a8b-4e63-8225-a4f6e1dc2379', 'AQ0001', 'AVAILABLE', 'Y', '2026-01-02 08:10:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('afcf128a-d314-47fc-999e-3d8f7a05bc62', 'ad4e9068-b1f2-45da-89a8-7b6d5e4f3a80', 'd63729f1-4a8b-4e63-8225-a4f6e1dc2379', 'AQ0002', 'AVAILABLE', 'Y', '2026-01-02 08:10:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('b0d0239b-e425-480d-aaaf-4e908b16cd73', 'be5fa179-c203-46eb-9ab9-8c7e6f5a4b91', 'e7483a02-5b9c-4f74-9336-b507f2ed348a', 'TK0001', 'AVAILABLE', 'Y', '2026-01-02 08:10:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('c1e134ac-f536-491e-8bc0-5fa19c27de84', 'be5fa179-c203-46eb-9ab9-8c7e6f5a4b91', 'e7483a02-5b9c-4f74-9336-b507f2ed348a', 'TK0002', 'AVAILABLE', 'Y', '2026-01-02 08:10:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10')
ON CONFLICT (barcode) DO UPDATE SET
    id_product = EXCLUDED.id_product,
    id_product_batch = EXCLUDED.id_product_batch,
    unit_status = EXCLUDED.unit_status,
    is_active = EXCLUDED.is_active,
    created_by = EXCLUDED.created_by;

INSERT INTO tbl_product_batches (
    id_product_batch,
    id_product,
    batch_code,
    expired_date,
    purchase_price,
    created_date,
    created_by
) VALUES
    ('794807a4-fb32-4c99-9e99-4a2ece3066f2', '0ca9e2c5-28fe-4568-bb32-5e64f3d81828', 'BATCH/260102/UMFC250/001', '2026-12-31', 5200.00, '2026-01-02 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('09c53bf2-930c-4355-9871-10954de8fb7f', '3bb4c2bf-07a3-430c-8a14-b86a07b00a54', 'BATCH/260102/IND-GRG/001', '2026-10-31', 3300.00, '2026-01-02 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('a74cf853-82b6-485d-a7db-5a47f902daf7', '811ef873-c921-4b88-a497-129d53b76987', 'BATCH/260102/AQUA600/001', '2027-01-31', 3500.00, '2026-01-02 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('f5bd3c4e-06a6-461b-bb44-4478e2a56510', '68c04c35-ade9-4940-8a94-16e6888a3ead', 'BATCH/260102/TK200/001', '2026-11-30', 4300.00, '2026-01-02 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('3adf7c66-a65d-4e16-a1ad-097cc76444e2', 'd71f2c16-471e-4e21-b10c-2f36ce9b283f', 'BATCH/260102/DIMSUM/001', '2026-02-15', 12000.00, '2026-01-02 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('5c1032ca-2411-488a-816d-639b7836194d', '2f277743-7479-49b9-b00e-48677a6a2b5b', 'BATCH/260102/DONAT/001', '2026-02-15', 4500.00, '2026-01-02 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('891f1f93-b2ae-4089-ad6e-338be81e8d1a', '22b29696-7682-43c0-8e04-5211ef612d6e', 'BATCH/260102/PULPEN/001', '2027-12-31', 1500.00, '2026-01-02 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('5de1465d-d6a8-4d1e-98b6-47861339e33d', 'c301b094-4191-41e0-9b61-baeb01d78336', 'BATCH/260102/PENSIL/001', '2027-12-31', 900.00, '2026-01-02 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc')
ON CONFLICT (id_product, batch_code) DO UPDATE SET
    expired_date = EXCLUDED.expired_date,
    purchase_price = EXCLUDED.purchase_price,
    created_by = EXCLUDED.created_by;

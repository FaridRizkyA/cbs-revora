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
    ('a42ec00e-29f3-483b-8d9f-805ec509e049', 'bd001e32-c262-4e28-bbfd-0b92bdbc4dbb', '0ca9e2c5-28fe-4568-bb32-5e64f3d81828', '794807a4-fb32-4c99-9e99-4a2ece3066f2', 25, '2026-12-31', '2026-01-02 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('2be0db6c-86a1-4cd6-a57b-5a54e9c7dbfc', 'bd001e32-c262-4e28-bbfd-0b92bdbc4dbb', '68c04c35-ade9-4940-8a94-16e6888a3ead', 'f5bd3c4e-06a6-461b-bb44-4478e2a56510', 12, '2026-11-30', '2026-01-02 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('98cca99f-ef1c-484a-8400-a2bbe72af163', 'df68a3b6-4895-4e6c-82e8-b8d4514bfa73', '3bb4c2bf-07a3-430c-8a14-b86a07b00a54', '09c53bf2-930c-4355-9871-10954de8fb7f', 20, '2026-10-31', '2026-01-02 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('2f4e4f37-5653-44bc-9e89-7b10a3dffca2', 'df68a3b6-4895-4e6c-82e8-b8d4514bfa73', '811ef873-c921-4b88-a497-129d53b76987', 'a74cf853-82b6-485d-a7db-5a47f902daf7', 15, '2027-01-31', '2026-01-02 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('cbde0845-720f-4966-9427-e6e8760dd392', 'b0630cc4-0c01-4af8-994d-60801b05d14c', 'd71f2c16-471e-4e21-b10c-2f36ce9b283f', '3adf7c66-a65d-4e16-a1ad-097cc76444e2', 5, '2026-02-15', '2026-01-02 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('64476ad2-efcb-4487-b717-e9a6524c13ed', 'b0630cc4-0c01-4af8-994d-60801b05d14c', '2f277743-7479-49b9-b00e-48677a6a2b5b', '5c1032ca-2411-488a-816d-639b7836194d', 8, '2026-02-15', '2026-01-02 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('4e87d6ed-17ff-4eda-adc3-0b9320ffb09c', '7aeed67b-618f-49de-b061-7dd7d847c2bf', '22b29696-7682-43c0-8e04-5211ef612d6e', '891f1f93-b2ae-4089-ad6e-338be81e8d1a', 20, '2027-12-31', '2026-01-02 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('5e2ded23-b019-404c-8e97-c9469a8b8206', '7aeed67b-618f-49de-b061-7dd7d847c2bf', 'c301b094-4191-41e0-9b61-baeb01d78336', '5de1465d-d6a8-4d1e-98b6-47861339e33d', 20, '2027-12-31', '2026-01-02 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc')
ON CONFLICT (id_stock_in_item) DO UPDATE SET
    id_stock_in = EXCLUDED.id_stock_in,
    id_product = EXCLUDED.id_product,
    id_product_batch = EXCLUDED.id_product_batch,
    quantity = EXCLUDED.quantity,
    expired_date = EXCLUDED.expired_date,
    created_by = EXCLUDED.created_by;


INSERT INTO tbl_products (
    id_product,
    product_code,
    barcode,
    product_name,
    description,
    id_supplier,
    selling_price,
    minimum_stock,
    product_image,
    is_active,
    created_date,
    created_by
) VALUES
    ('0ca9e2c5-28fe-4568-bb32-5e64f3d81828', 'PRD-ULTR-MLK-250ML', '8992761132012', 'Ultra Milk 250ml', 'Produk minuman susu kemasan dengan barcode.', '293284a7-11b4-4035-97ad-cd699031d7d8', 7000.00, 10, NULL, 'Y', '2026-01-01 08:10:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('3bb4c2bf-07a3-430c-8a14-b86a07b00a54', 'PRD-INDM-GRNG', '8992388111117', 'Indomie Goreng', 'Mi instan kemasan dengan barcode.', '8facb242-8306-450e-81c9-fdd5f94fe545', 4500.00, 20, NULL, 'Y', '2026-01-01 08:10:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('811ef873-c921-4b88-a497-129d53b76987', 'PRD-AQ-600ML', '8999999054321', 'Aqua 600ml', 'Air mineral botol 600ml dengan barcode.', '8facb242-8306-450e-81c9-fdd5f94fe545', 5000.00, 15, NULL, 'Y', '2026-01-01 08:10:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('68c04c35-ade9-4940-8a94-16e6888a3ead', 'PRD-TH-KTK', '8998866200056', 'Teh Kotak', 'Minuman teh kotak dengan barcode.', '293284a7-11b4-4035-97ad-cd699031d7d8', 6000.00, 12, NULL, 'Y', '2026-01-01 08:10:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('d71f2c16-471e-4e21-b10c-2f36ce9b283f', 'PRD-DMSM', NULL, 'Dimsum', 'Produk makanan titipan UMKM tanpa barcode.', '41c23d6b-8fd0-4c2f-a0bc-6d702db8d021', 12000.00, 5, NULL, 'Y', '2026-01-01 08:10:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('2f277743-7479-49b9-b00e-48677a6a2b5b', 'PRD-DNT-MKM', NULL, 'Donat UMKM', 'Donat titipan UMKM tanpa barcode.', '41c23d6b-8fd0-4c2f-a0bc-6d702db8d021', 5000.00, 8, NULL, 'Y', '2026-01-01 08:10:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('22b29696-7682-43c0-8e04-5211ef612d6e', 'PRD-PLPN', NULL, 'Pulpen', 'Alat tulis tanpa barcode.', 'fc0d12c0-1a2a-4b20-984e-edd50c661a84', 3000.00, 20, NULL, 'Y', '2026-01-01 08:10:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('c301b094-4191-41e0-9b61-baeb01d78336', 'PRD-PNSL', NULL, 'Pensil', 'Pensil tulis tanpa barcode.', 'fc0d12c0-1a2a-4b20-984e-edd50c661a84', 2500.00, 20, NULL, 'Y', '2026-01-01 08:10:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('7aecd6be-a641-40aa-beb0-8ba0ceca01f7', 'PRD-FTKP', NULL, 'Fotokopi', 'Jasa fotokopi per lembar tanpa barcode.', 'fc0d12c0-1a2a-4b20-984e-edd50c661a84', 500.00, 0, NULL, 'Y', '2026-01-01 08:10:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc')
ON CONFLICT (id_product) DO UPDATE SET
    product_code = EXCLUDED.product_code,
    product_name = EXCLUDED.product_name,
    barcode = EXCLUDED.barcode,
    description = EXCLUDED.description,
    id_supplier = EXCLUDED.id_supplier,
    selling_price = EXCLUDED.selling_price,
    minimum_stock = EXCLUDED.minimum_stock,
    product_image = EXCLUDED.product_image,
    is_active = EXCLUDED.is_active,
    created_by = EXCLUDED.created_by;


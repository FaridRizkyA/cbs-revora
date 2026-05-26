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
    ('8b2c7e46-9fd0-43b8-87e6-5f4b3c2d1e68', 'PRD-UM250', '8992761132012', 'Ultra Milk 250ml', 'Produk minuman susu kemasan dengan barcode.', 'a77aa111-1111-4a77-8b11-111111111111', 7000.00, 10, NULL, 'Y', '2026-01-01 08:10:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('9c3d8f57-a0e1-44c9-98f7-6a5c4d3e2f79', 'PRD-IND-GRG', '8992388111117', 'Indomie Goreng', 'Mi instan kemasan dengan barcode.', 'b88bb222-2222-4b88-8c22-222222222222', 4500.00, 20, NULL, 'Y', '2026-01-01 08:10:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('ad4e9068-b1f2-45da-89a8-7b6d5e4f3a80', 'PRD-AQ600', '8999999054321', 'Aqua 600ml', 'Air mineral botol 600ml dengan barcode.', 'b88bb222-2222-4b88-8c22-222222222222', 5000.00, 15, NULL, 'Y', '2026-01-01 08:10:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('be5fa179-c203-46eb-9ab9-8c7e6f5a4b91', 'PRD-TK', '8998866200056', 'Teh Kotak', 'Minuman teh kotak dengan barcode.', 'a77aa111-1111-4a77-8b11-111111111111', 6000.00, 12, NULL, 'Y', '2026-01-01 08:10:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('cf60b28a-d314-47fc-8bca-9d8f7a6b5c02', 'PRD-DIMSUM', NULL, 'Dimsum', 'Produk makanan titipan UMKM tanpa barcode.', 'c99cc333-3333-4c99-8d33-333333333333', 12000.00, 5, NULL, 'Y', '2026-01-01 08:10:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('d071c39b-e425-480d-9cdb-ae908b7c6d13', 'PRD-DONAT-UMKM', NULL, 'Donat UMKM', 'Donat titipan UMKM tanpa barcode.', 'c99cc333-3333-4c99-8d33-333333333333', 5000.00, 8, NULL, 'Y', '2026-01-01 08:10:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('e182d4ac-f536-491e-ade0-bfa19c8d7e24', 'PRD-PULPEN', NULL, 'Pulpen', 'Alat tulis tanpa barcode.', 'd00dd444-4444-4d00-8e44-444444444444', 3000.00, 20, NULL, 'Y', '2026-01-01 08:10:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('f293e5bd-0647-4a2f-8ef1-c0b2ad9e8f35', 'PRD-PENSIL', NULL, 'Pensil', 'Pensil tulis tanpa barcode.', 'd00dd444-4444-4d00-8e44-444444444444', 2500.00, 20, NULL, 'Y', '2026-01-01 08:10:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('a304f6ce-1758-4b30-9f02-d1c3bea9f046', 'PRD-FOTOKOPI', NULL, 'Fotokopi', 'Jasa fotokopi per lembar tanpa barcode.', 'd00dd444-4444-4d00-8e44-444444444444', 500.00, 0, NULL, 'Y', '2026-01-01 08:10:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10')
ON CONFLICT (product_code) DO UPDATE SET
    product_name = EXCLUDED.product_name,
    barcode = EXCLUDED.barcode,
    description = EXCLUDED.description,
    id_supplier = EXCLUDED.id_supplier,
    selling_price = EXCLUDED.selling_price,
    minimum_stock = EXCLUDED.minimum_stock,
    product_image = EXCLUDED.product_image,
    is_active = EXCLUDED.is_active,
    created_by = EXCLUDED.created_by;


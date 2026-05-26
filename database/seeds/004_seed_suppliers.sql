INSERT INTO tbl_suppliers (
    id_supplier,
    supplier_code,
    supplier_name,
    city,
    phone_number,
    is_active,
    created_date,
    created_by
) VALUES
    ('a77aa111-1111-4a77-8b11-111111111111', 'SUP-001', 'PT Sumber Pangan Nusantara', 'Bandung', '0812-3344-8899', 'Y', NOW(), '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('b88bb222-2222-4b88-8c22-222222222222', 'SUP-002', 'CV Makmur Bersama', 'Jakarta', '0813-9911-2233', 'Y', NOW(), '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('c99cc333-3333-4c99-8d33-333333333333', 'SUP-003', 'UD Tani Sejahtera', 'Yogyakarta', '0821-4477-6655', 'N', NOW(), '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('d00dd444-4444-4d00-8e44-444444444444', 'SUP-004', 'PT Sentra Agro Lestari', 'Semarang', '0819-1234-5678', 'Y', NOW(), '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10')
ON CONFLICT (supplier_code) DO UPDATE SET
    supplier_name = EXCLUDED.supplier_name,
    city = EXCLUDED.city,
    phone_number = EXCLUDED.phone_number,
    is_active = EXCLUDED.is_active;


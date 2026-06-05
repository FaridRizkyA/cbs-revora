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
    ('293284a7-11b4-4035-97ad-cd699031d7d8', 'SUP-001', 'PT Sumber Pangan Nusantara', 'Bandung', '0812-3344-8899', 'Y', NOW(), '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('8facb242-8306-450e-81c9-fdd5f94fe545', 'SUP-002', 'CV Makmur Bersama', 'Jakarta', '0813-9911-2233', 'Y', NOW(), '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('41c23d6b-8fd0-4c2f-a0bc-6d702db8d021', 'SUP-003', 'UD Tani Sejahtera', 'Yogyakarta', '0821-4477-6655', 'N', NOW(), '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('fc0d12c0-1a2a-4b20-984e-edd50c661a84', 'SUP-004', 'PT Sentra Agro Lestari', 'Semarang', '0819-1234-5678', 'Y', NOW(), '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc')
ON CONFLICT (supplier_code) DO UPDATE SET
    supplier_name = EXCLUDED.supplier_name,
    city = EXCLUDED.city,
    phone_number = EXCLUDED.phone_number,
    is_active = EXCLUDED.is_active;


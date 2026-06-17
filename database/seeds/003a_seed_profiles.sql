INSERT INTO tbl_profiles (
    id_profile,
    id_user,
    first_name,
    last_name,
    phone_number,
    address,
    profile_image,
    is_active,
    created_date,
    created_by
)
SELECT
    x.id_profile,
    x.id_user,
    x.first_name,
    x.last_name,
    x.phone_number,
    x.address,
    NULL,
    'Y',
    x.created_date,
    x.created_by
FROM (
    VALUES
        ('c2d868da-3735-44f9-bb2e-60e7e5470ce9'::uuid, '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'::uuid, 'Admin', 'CBS Revora', '081234560000', 'Jl. Kampus Revora No. 1, Bandung', '2026-01-01 08:05:00'::timestamp, NULL::uuid),
        ('3b744d08-5ba7-4d4f-8681-1efacfb86542'::uuid, 'e3d5241c-50a1-46be-a55a-c4e0c2f173e9'::uuid, 'Ahmad', 'Fauzi', '081234560001', 'Jl. Kampus Revora No. 1, Bandung', '2026-01-01 08:05:00'::timestamp, '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'::uuid),
        ('c8c42dea-3568-4cd5-a082-74af640bcc01'::uuid, 'e798eb10-c8bc-458f-8b6c-0f5ff46aba5a'::uuid, 'Siti', 'Aminah', '081234560006', 'Jl. Kampus Revora No. 1, Bandung', '2026-01-01 08:05:00'::timestamp, '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'::uuid),
        ('a92506d8-5b1c-4326-8ee8-cccf9f9a130a'::uuid, '109745bd-441a-4af2-8792-d5d46f63d334'::uuid, 'Rina', 'Kartika', '081234560002', 'Jl. Merdeka No. 17, Bandung', '2026-01-01 08:05:00'::timestamp, '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'::uuid),
        ('6849bc89-b36a-4787-ae88-a4de25d5e7ad'::uuid, 'c6f1a22e-1f65-4355-be54-69ae3d326457'::uuid, 'Dimas', 'Pratama', '081234560003', 'Jl. Sukajadi No. 22, Bandung', '2026-01-01 08:05:00'::timestamp, '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'::uuid),
        ('54d9a801-0f5e-452e-a0b9-447584da1755'::uuid, 'e8eda068-f1ae-449e-8275-09cd4a2adf1c'::uuid, 'Budi', 'Santoso', '081234560004', 'Jl. Setiabudi No. 12, Bandung', '2026-01-01 08:05:00'::timestamp, '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'::uuid),
        ('169333fe-02c9-4b50-9120-41f75224a7c0'::uuid, '81388bae-aab2-498c-98e7-5aa963c34a52'::uuid, 'Sri', 'Wulandari', '081234560005', 'Jl. Cihampelas No. 9, Bandung', '2026-01-01 08:05:00'::timestamp, '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'::uuid),
        ('30393e1f-0800-415a-9c62-6648937f4f96'::uuid, '4b9c856e-c33c-4d1b-9902-c22c12e79695'::uuid, 'Andi', 'Saputra', '082112340001', 'Jl. Cikutra No. 10, Bandung', '2026-01-05 08:55:00'::timestamp, '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'::uuid),
        ('83629890-1451-4439-b714-01f73743489d'::uuid, '3f25038b-2741-4c81-964f-a5ad3fcd955d'::uuid, 'Dewi', 'Lestari', '082112340002', 'Jl. Gegerkalong Hilir No. 8, Bandung', '2026-01-06 08:55:00'::timestamp, '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'::uuid),
        ('bed21488-23a9-4180-9eea-8eee68e15c28'::uuid, '54cc6ab0-e44f-404f-8160-c19e469da7f6'::uuid, 'Muhammad', 'Farhan', '082112340003', 'Jl. Dipatiukur No. 45, Bandung', '2026-01-07 08:55:00'::timestamp, '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'::uuid),
        ('855c852d-fcb1-440d-9d98-ef99108d3481'::uuid, '979aa548-dd41-4da9-abc7-b7a5050fb161'::uuid, 'Nabila', 'Putri', '082112340004', 'Jl. Setiabudi No. 31, Bandung', '2026-01-08 08:55:00'::timestamp, '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'::uuid),
        ('35b7ba75-a552-4cea-920d-f3cd24762e8d'::uuid, '69861a00-ed21-4e78-88a3-a7f6b8134f50'::uuid, 'Bima', 'Arya Nugraha', '082112340005', 'Jl. Tubagus Ismail No. 12, Bandung', '2026-01-09 08:55:00'::timestamp, '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'::uuid),
        ('2a3b4c5d-6e7f-8a9b-0c1d-2e3f4a5b6c7d'::uuid, '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d'::uuid, 'Ahmad', 'Husein', '081234560007', 'Jl. Kampus Revora No. 2, Bandung', '2026-01-01 08:05:00'::timestamp, '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'::uuid)
) AS x(id_profile, id_user, first_name, last_name, phone_number, address, created_date, created_by)
ON CONFLICT (id_user) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone_number = EXCLUDED.phone_number,
    address = EXCLUDED.address,
    is_active = EXCLUDED.is_active,
    created_by = EXCLUDED.created_by;

INSERT INTO tbl_roles (
    id_role,
    role_name,
    description,
    is_active,
    created_date,
    created_by
) VALUES
    ('a7d0c449-567b-422d-b0a2-e46628cdd49f', 'ADMIN', 'Administrator sistem dengan akses penuh.', 'Y', '2026-01-01 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('9288fe0f-4cfc-461b-921f-8da51d7f0c0b', 'STAFF', 'Staff koperasi untuk pengelolaan operasional.', 'Y', '2026-01-01 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('fc38822b-bab5-4ced-b49e-2b1d3560582f', 'CASHIER', 'Kasir untuk transaksi penjualan harian.', 'Y', '2026-01-01 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('52870eef-332d-4c94-be67-92570b4633f3', 'MEMBER', 'Anggota koperasi kampus.', 'Y', '2026-01-01 08:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc')
ON CONFLICT (role_name) DO UPDATE SET
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    created_by = EXCLUDED.created_by;

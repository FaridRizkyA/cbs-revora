INSERT INTO tbl_roles (
    id_role,
    role_name,
    description,
    is_active,
    created_date,
    created_by
) VALUES
    ('2a2b8d3e-1b1c-4d63-b7f2-0f34c64dcf01', 'ADMIN', 'Administrator sistem dengan akses penuh.', 'Y', '2026-01-01 08:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('5c9d1b83-4e71-4d8f-9f84-3c9a1b9fcb02', 'STAFF', 'Staff koperasi untuk pengelolaan operasional.', 'Y', '2026-01-01 08:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('7d8f2a91-23ab-4569-8a90-7d12cb34ee03', 'CASHIER', 'Kasir untuk transaksi penjualan harian.', 'Y', '2026-01-01 08:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('9e4a6c71-8f02-4c11-9e7d-2b1c4f5a6d04', 'MEMBER', 'Anggota koperasi kampus.', 'Y', '2026-01-01 08:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10')
ON CONFLICT (role_name) DO UPDATE SET
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    created_by = EXCLUDED.created_by;

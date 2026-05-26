INSERT INTO tbl_member_savings (
    id_member_saving,
    id_member,
    saving_type,
    transaction_type,
    amount,
    transaction_date,
    notes,
    is_active,
    created_date,
    created_by
) VALUES
    ('f41467df-2869-4c41-8ef3-82d4cf5a01b7', '3c7d2f91-4a8b-4e63-b2f1-0a9c8d7e6f13', 'POKOK', 'DEPOSIT', 50000.00, '2026-01-05 09:15:00', 'Setoran simpanan pokok awal anggota.', 'Y', '2026-01-05 09:15:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('a52578e0-397a-4d52-9f04-93e5d06b12c8', '3c7d2f91-4a8b-4e63-b2f1-0a9c8d7e6f13', 'WAJIB', 'DEPOSIT', 25000.00, '2026-01-05 09:20:00', 'Setoran simpanan wajib bulan Januari.', 'Y', '2026-01-05 09:20:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('b63689f1-4a8b-4e63-a015-a4f6e17c23d9', '4d8e3a02-5b9c-4f74-c3a2-1b0d9e8f7a24', 'POKOK', 'DEPOSIT', 50000.00, '2026-01-06 09:15:00', 'Setoran simpanan pokok awal anggota.', 'Y', '2026-01-06 09:15:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('c7479a02-5b9c-4f74-8126-b507f28d34ea', '4d8e3a02-5b9c-4f74-c3a2-1b0d9e8f7a24', 'SUKARELA', 'DEPOSIT', 75000.00, '2026-01-06 09:20:00', 'Setoran simpanan sukarela.', 'Y', '2026-01-06 09:20:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('d858ab13-6cad-4085-9237-c618039e45fb', '5e9f4b13-6cad-4085-94b3-2c1e0f9a8b35', 'POKOK', 'DEPOSIT', 50000.00, '2026-01-07 09:15:00', 'Setoran simpanan pokok awal anggota.', 'Y', '2026-01-07 09:15:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('e969bc24-7dbe-4196-a348-d72914af560c', '5e9f4b13-6cad-4085-94b3-2c1e0f9a8b35', 'WAJIB', 'DEPOSIT', 25000.00, '2026-01-07 09:20:00', 'Setoran simpanan wajib bulan Januari.', 'Y', '2026-01-07 09:20:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('fa7acd35-8ecf-42a7-b459-e83a25b0671d', '6f0a5c24-7dbe-4196-a5c4-3d2f1a0b9c46', 'POKOK', 'DEPOSIT', 50000.00, '2026-01-08 09:15:00', 'Setoran simpanan pokok awal anggota.', 'Y', '2026-01-08 09:15:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('ab8bde46-9fd0-43b8-856a-f94b36c1782e', '7a1b6d35-8ecf-42a7-b6d5-4e3a2b1c0d57', 'POKOK', 'DEPOSIT', 50000.00, '2026-01-09 09:15:00', 'Setoran simpanan pokok awal anggota.', 'Y', '2026-01-09 09:15:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('bc9cef57-a0e1-44c9-967b-0a5c47d2893f', '7a1b6d35-8ecf-42a7-b6d5-4e3a2b1c0d57', 'SUKARELA', 'DEPOSIT', 100000.00, '2026-01-09 09:20:00', 'Setoran simpanan sukarela.', 'Y', '2026-01-09 09:20:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10')
ON CONFLICT (id_member_saving) DO UPDATE SET
    id_member = EXCLUDED.id_member,
    saving_type = EXCLUDED.saving_type,
    transaction_type = EXCLUDED.transaction_type,
    amount = EXCLUDED.amount,
    transaction_date = EXCLUDED.transaction_date,
    notes = EXCLUDED.notes,
    is_active = EXCLUDED.is_active,
    created_by = EXCLUDED.created_by;

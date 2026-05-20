INSERT INTO tbl_members (
    id_member,
    id_user,
    member_code,
    full_name,
    phone_number,
    address,
    join_date,
    total_spending,
    is_active,
    created_date,
    created_by
) VALUES
    ('3c7d2f91-4a8b-4e63-b2f1-0a9c8d7e6f13', '31a2b4c6-d8e0-4f12-9a34-b5c6d7e8f901', 'MBR001', 'Andi Saputra', '082112340001', 'Jl. Cikutra No. 10, Bandung', '2026-01-05', 125000.00, 'Y', '2026-01-05 09:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('4d8e3a02-5b9c-4f74-c3a2-1b0d9e8f7a24', '42b3c5d7-e9f1-4023-8b45-c6d7e8f90112', 'MBR002', 'Dewi Lestari', '082112340002', 'Jl. Gegerkalong Hilir No. 8, Bandung', '2026-01-06', 87500.00, 'Y', '2026-01-06 09:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('5e9f4b13-6cad-4085-94b3-2c1e0f9a8b35', '53c4d6e8-f0a2-4134-9c56-d7e8f9011223', 'MBR003', 'Muhammad Farhan', '082112340003', 'Jl. Dipatiukur No. 45, Bandung', '2026-01-07', 214000.00, 'Y', '2026-01-07 09:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('6f0a5c24-7dbe-4196-a5c4-3d2f1a0b9c46', '64d5e7f9-a1b3-4245-8d67-e8f901122334', 'MBR004', 'Nabila Putri', '082112340004', 'Jl. Setiabudi No. 31, Bandung', '2026-01-08', 43000.00, 'Y', '2026-01-08 09:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('7a1b6d35-8ecf-42a7-b6d5-4e3a2b1c0d57', '75e6f8a0-b2c4-4356-9e78-f90112233445', 'MBR005', 'Bima Arya Nugraha', '082112340005', 'Jl. Tubagus Ismail No. 12, Bandung', '2026-01-09', 159500.00, 'Y', '2026-01-09 09:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10')
ON CONFLICT (member_code) DO UPDATE SET
    id_user = EXCLUDED.id_user,
    full_name = EXCLUDED.full_name,
    phone_number = EXCLUDED.phone_number,
    address = EXCLUDED.address,
    join_date = EXCLUDED.join_date,
    total_spending = EXCLUDED.total_spending,
    is_active = EXCLUDED.is_active,
    created_by = EXCLUDED.created_by;

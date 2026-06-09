INSERT INTO tbl_members (
    id_member,
    id_user,
    member_code,
    join_date,
    total_spending,
    is_active,
    created_date,
    created_by
) VALUES
    ('7ab2edb0-b27c-44bb-bf5e-bfedaa9458b4', '4b9c856e-c33c-4d1b-9902-c22c12e79695', 'MBR-001', '2026-01-05', 125000.00, 'Y', '2026-01-05 09:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('f9294704-b5da-43ab-a9fb-5714a7f67b8f', '3f25038b-2741-4c81-964f-a5ad3fcd955d', 'MBR-002', '2026-01-06', 87500.00, 'Y', '2026-01-06 09:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('ff883d77-3386-487f-9f57-0608e0e23981', '54cc6ab0-e44f-404f-8160-c19e469da7f6', 'MBR-003', '2026-01-07', 214000.00, 'Y', '2026-01-07 09:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('eff12e75-aa83-466a-9f58-3f89ca7f18dc', '979aa548-dd41-4da9-abc7-b7a5050fb161', 'MBR-004', '2026-01-08', 43000.00, 'Y', '2026-01-08 09:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'),
    ('caa2a8d1-3cfc-43e5-b045-96c56924c6c0', '69861a00-ed21-4e78-88a3-a7f6b8134f50', 'MBR-005', '2026-01-09', 159500.00, 'Y', '2026-01-09 09:00:00', '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc')
ON CONFLICT (member_code) DO UPDATE SET
    id_user = EXCLUDED.id_user,
    join_date = EXCLUDED.join_date,
    total_spending = EXCLUDED.total_spending,
    is_active = EXCLUDED.is_active,
    created_by = EXCLUDED.created_by;

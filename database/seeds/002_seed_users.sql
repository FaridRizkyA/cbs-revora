INSERT INTO tbl_users (
    id_user,
    email,
    password_hash,
    is_active,
    created_date,
    created_by
) VALUES
    (
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc',
        'admin@cbsrevora.local',
        '$2b$10$RC8C.90Ig5tZ3ocKa.voiebbPFNXoCCY22vT/idXuh8uD26LrvbDe',
        'Y',
        '2026-01-01 08:05:00',
        NULL
    ),
    (
        'e3d5241c-50a1-46be-a55a-c4e0c2f173e9',
        'chairperson@cbsrevora.local',
        '$2b$10$RC8C.90Ig5tZ3ocKa.voiebbPFNXoCCY22vT/idXuh8uD26LrvbDe',
        'Y',
        '2026-01-01 08:05:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        'e798eb10-c8bc-458f-8b6c-0f5ff46aba5a',
        'vice.chair@cbsrevora.local',
        '$2b$10$RC8C.90Ig5tZ3ocKa.voiebbPFNXoCCY22vT/idXuh8uD26LrvbDe',
        'Y',
        '2026-01-01 08:05:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '109745bd-441a-4af2-8792-d5d46f63d334',
        'treasurer@cbsrevora.local',
        '$2b$10$RC8C.90Ig5tZ3ocKa.voiebbPFNXoCCY22vT/idXuh8uD26LrvbDe',
        'Y',
        '2026-01-01 08:05:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        'c6f1a22e-1f65-4355-be54-69ae3d326457',
        'cashier@cbsrevora.local',
        '$2b$10$RC8C.90Ig5tZ3ocKa.voiebbPFNXoCCY22vT/idXuh8uD26LrvbDe',
        'Y',
        '2026-01-01 08:05:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        'e8eda068-f1ae-449e-8275-09cd4a2adf1c',
        'supervisor@cbsrevora.local',
        '$2b$10$RC8C.90Ig5tZ3ocKa.voiebbPFNXoCCY22vT/idXuh8uD26LrvbDe',
        'Y',
        '2026-01-01 08:05:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '81388bae-aab2-498c-98e7-5aa963c34a52',
        'advisor@cbsrevora.local',
        '$2b$10$RC8C.90Ig5tZ3ocKa.voiebbPFNXoCCY22vT/idXuh8uD26LrvbDe',
        'Y',
        '2026-01-01 08:05:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
        'staff@cbsrevora.local',
        '$2b$10$RC8C.90Ig5tZ3ocKa.voiebbPFNXoCCY22vT/idXuh8uD26LrvbDe',
        'Y',
        '2026-01-01 08:05:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '4b9c856e-c33c-4d1b-9902-c22c12e79695',
        'mbr001@cbsrevora.local',
        '$2b$10$RC8C.90Ig5tZ3ocKa.voiebbPFNXoCCY22vT/idXuh8uD26LrvbDe',
        'Y',
        '2026-01-05 08:55:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '3f25038b-2741-4c81-964f-a5ad3fcd955d',
        'mbr002@cbsrevora.local',
        '$2b$10$RC8C.90Ig5tZ3ocKa.voiebbPFNXoCCY22vT/idXuh8uD26LrvbDe',
        'Y',
        '2026-01-06 08:55:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '54cc6ab0-e44f-404f-8160-c19e469da7f6',
        'mbr003@cbsrevora.local',
        '$2b$10$RC8C.90Ig5tZ3ocKa.voiebbPFNXoCCY22vT/idXuh8uD26LrvbDe',
        'Y',
        '2026-01-07 08:55:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '979aa548-dd41-4da9-abc7-b7a5050fb161',
        'mbr004@cbsrevora.local',
        '$2b$10$RC8C.90Ig5tZ3ocKa.voiebbPFNXoCCY22vT/idXuh8uD26LrvbDe',
        'Y',
        '2026-01-08 08:55:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '69861a00-ed21-4e78-88a3-a7f6b8134f50',
        'mbr005@cbsrevora.local',
        '$2b$10$RC8C.90Ig5tZ3ocKa.voiebbPFNXoCCY22vT/idXuh8uD26LrvbDe',
        'Y',
        '2026-01-09 08:55:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    )
ON CONFLICT (email) DO UPDATE SET
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    is_active = EXCLUDED.is_active,
    created_by = EXCLUDED.created_by;

INSERT INTO tbl_staff_officer_roles (
    id_staff_officer_role,
    id_staff,
    officer_role_code,
    effective_start_date,
    effective_end_date,
    is_shu_eligible,
    is_active,
    created_date,
    created_by
) VALUES
    (
        '76f03d79-7cce-4e77-853c-dafbce8090dd',
        '43d330fd-f67d-4272-880b-8b43221d6c53',
        'CHAIRPERSON',
        '2025-12-01',
        NULL,
        'Y',
        'Y',
        '2026-01-01 08:10:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        'e0a8aa54-6723-4d0c-8659-4c9445dfd0e6',
        'a1c6da1c-6492-4499-937d-902ba3b62363',
        'VICE_CHAIRPERSON',
        '2025-12-01',
        NULL,
        'Y',
        'Y',
        '2026-01-01 08:10:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '7b03ac5f-c02d-4a4b-b344-660ceee426e2',
        '33641d3a-3949-403f-952c-083aacaf827d',
        'TREASURER',
        '2025-12-01',
        NULL,
        'Y',
        'Y',
        '2026-01-01 08:10:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '3aff6ee7-4eef-4bdb-97a8-237b18abfce6',
        '9100b9fd-2129-4e53-bc52-f47b129986b4',
        'SUPERVISOR',
        '2025-12-01',
        NULL,
        'Y',
        'Y',
        '2026-01-01 08:10:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        'ba60817c-5412-49bf-a0d4-0b9a4ac158bb',
        '9b124f15-bc3a-4064-b8db-e0b8a15d3f31',
        'ADVISOR',
        '2025-12-01',
        NULL,
        'Y',
        'Y',
        '2026-01-01 08:10:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    )
ON CONFLICT (id_staff, officer_role_code) WHERE effective_end_date IS NULL AND is_active = 'Y'
DO UPDATE SET
    is_shu_eligible = EXCLUDED.is_shu_eligible,
    is_active = EXCLUDED.is_active,
    created_by = EXCLUDED.created_by;

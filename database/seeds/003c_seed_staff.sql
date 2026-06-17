INSERT INTO tbl_staff (
    id_staff,
    id_user,
    id_staff_grade,
    staff_code,
    join_date,
    is_active,
    created_date,
    created_by
) VALUES
    (
        '54769c66-439f-4d95-86a0-199bfdd81f00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc',
        '8662e5a7-9785-4925-a764-1ee4f8b9f6fd',
        'STF-001',
        '2024-01-01',
        'Y',
        '2026-01-01 08:05:00',
        NULL
    ),
    (
        '43d330fd-f67d-4272-880b-8b43221d6c53',
        'e3d5241c-50a1-46be-a55a-c4e0c2f173e9',
        '88c93555-a679-44fb-9548-e3c4d15e0f47',
        'STF-002',
        '2024-01-01',
        'Y',
        '2026-01-01 08:05:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        'a1c6da1c-6492-4499-937d-902ba3b62363',
        'e798eb10-c8bc-458f-8b6c-0f5ff46aba5a',
        '56e7ae45-b8a7-4531-abda-f12f27b688b8',
        'STF-007',
        '2024-01-01',
        'Y',
        '2026-01-01 08:05:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '33641d3a-3949-403f-952c-083aacaf827d',
        '109745bd-441a-4af2-8792-d5d46f63d334',
        '817f61fe-1b8d-4c28-bd11-c6f05eeff8e4',
        'STF-003',
        '2024-01-01',
        'Y',
        '2026-01-01 08:05:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '1171713d-014e-4209-906c-cec8b8f32cb9',
        'c6f1a22e-1f65-4355-be54-69ae3d326457',
        '8662e5a7-9785-4925-a764-1ee4f8b9f6fd',
        'STF-004',
        '2024-01-01',
        'Y',
        '2026-01-01 08:05:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '9100b9fd-2129-4e53-bc52-f47b129986b4',
        'e8eda068-f1ae-449e-8275-09cd4a2adf1c',
        'b99045b3-891d-49a5-b7f7-b195a35f06ec',
        'STF-005',
        '2024-01-01',
        'Y',
        '2026-01-01 08:05:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '9b124f15-bc3a-4064-b8db-e0b8a15d3f31',
        '81388bae-aab2-498c-98e7-5aa963c34a52',
        '4ad9a4ff-c9f7-4fa9-8d0a-25730ac9de84',
        'STF-006',
        '2024-01-01',
        'Y',
        '2026-01-01 08:05:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '3a4b5c6d-7e8f-9a0b-1c2d-3e4f5a6b7c8d',
        '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
        '8662e5a7-9785-4925-a764-1ee4f8b9f6fd',
        'STF-008',
        '2024-01-01',
        'Y',
        '2026-01-01 08:05:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    )
ON CONFLICT (id_user) DO UPDATE SET
    id_staff_grade = EXCLUDED.id_staff_grade,
    staff_code = EXCLUDED.staff_code,
    join_date = EXCLUDED.join_date,
    is_active = EXCLUDED.is_active,
    created_by = EXCLUDED.created_by;

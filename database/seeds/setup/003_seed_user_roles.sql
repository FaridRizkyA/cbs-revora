INSERT INTO tbl_user_roles (
    id_user_role,
    id_user,
    id_role,
    effective_start_date,
    is_active,
    created_date,
    created_by
) VALUES
    (
        '1ec4265c-f12f-4527-b18c-2faa19d3e89d',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc',
        'a7d0c449-567b-422d-b0a2-e46628cdd49f',
        '2026-01-01',
        'Y',
        '2026-01-01 08:05:00',
        NULL
    ),
    (
        'c57e0cc2-07b3-49d3-b047-668c80efaf43',
        'e3d5241c-50a1-46be-a55a-c4e0c2f173e9',
        '9288fe0f-4cfc-461b-921f-8da51d7f0c0b',
        '2026-01-01',
        'Y',
        '2026-01-01 08:05:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '681a808c-f78f-44de-ba36-1398e001fd83',
        'e798eb10-c8bc-458f-8b6c-0f5ff46aba5a',
        '9288fe0f-4cfc-461b-921f-8da51d7f0c0b',
        '2026-01-01',
        'Y',
        '2026-01-01 08:05:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '10fc1071-d056-4101-93dd-9151c020a7e5',
        '109745bd-441a-4af2-8792-d5d46f63d334',
        '9288fe0f-4cfc-461b-921f-8da51d7f0c0b',
        '2026-01-01',
        'Y',
        '2026-01-01 08:05:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        'fd80309b-0484-467e-b38b-f06eb8332a94',
        'c6f1a22e-1f65-4355-be54-69ae3d326457',
        'fc38822b-bab5-4ced-b49e-2b1d3560582f',
        '2026-01-01',
        'Y',
        '2026-01-01 08:05:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '44e8dd7e-f494-41bd-b67b-bc05c55134f3',
        'e8eda068-f1ae-449e-8275-09cd4a2adf1c',
        '9288fe0f-4cfc-461b-921f-8da51d7f0c0b',
        '2026-01-01',
        'Y',
        '2026-01-01 08:05:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '5add533d-d509-4ba3-972e-ea2fd268b3af',
        '81388bae-aab2-498c-98e7-5aa963c34a52',
        '9288fe0f-4cfc-461b-921f-8da51d7f0c0b',
        '2026-01-01',
        'Y',
        '2026-01-01 08:05:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '4a5b6c7d-8e9f-0a1b-2c3d-4e5f6a7b8c9d',
        '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
        '9288fe0f-4cfc-461b-921f-8da51d7f0c0b',
        '2026-01-01',
        'Y',
        '2026-01-01 08:05:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    )
ON CONFLICT (id_user, id_role) DO UPDATE SET
    effective_start_date = EXCLUDED.effective_start_date,
    is_active = EXCLUDED.is_active,
    created_by = EXCLUDED.created_by;

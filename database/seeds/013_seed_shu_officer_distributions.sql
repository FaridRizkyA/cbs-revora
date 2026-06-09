INSERT INTO tbl_shu_officer_distributions (
    id_shu_officer_distribution,
    id_shu_period,
    id_staff,
    officer_role_code,
    shu_amount,
    distribution_status,
    is_active,
    created_date,
    created_by
) VALUES
    (
        '6f0bdce3-2006-4c39-9f76-ad777b02ef4d',
        '7d0553de-6f59-4ac8-88ad-50a78de74044',
        '43d330fd-f67d-4272-880b-8b43221d6c53',
        'CHAIRPERSON',
        71800.00,
        'CALCULATED',
        'Y',
        '2026-02-01 10:10:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '75b17915-e927-4215-b7d5-8a21c0b79167',
        '7d0553de-6f59-4ac8-88ad-50a78de74044',
        'a1c6da1c-6492-4499-937d-902ba3b62363',
        'VICE_CHAIRPERSON',
        71800.00,
        'CALCULATED',
        'Y',
        '2026-02-01 10:10:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        'b53a1c6d-1ded-4b58-b965-81890c68beef',
        '7d0553de-6f59-4ac8-88ad-50a78de74044',
        '33641d3a-3949-403f-952c-083aacaf827d',
        'TREASURER',
        71800.00,
        'CALCULATED',
        'Y',
        '2026-02-01 10:10:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        '88888888-8888-4888-8888-888888888888',
        '43d330fd-f67d-4272-880b-8b43221d6c53',
        'CHAIRPERSON',
        120000.00,
        'CALCULATED',
        'Y',
        '2025-12-01 10:10:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        'ffffffff-ffff-4fff-8fff-ffffffffffff',
        '88888888-8888-4888-8888-888888888888',
        'a1c6da1c-6492-4499-937d-902ba3b62363',
        'VICE_CHAIRPERSON',
        120000.00,
        'CALCULATED',
        'Y',
        '2025-12-01 10:10:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '00000000-0000-4000-8000-000000000000',
        '88888888-8888-4888-8888-888888888888',
        '33641d3a-3949-403f-952c-083aacaf827d',
        'TREASURER',
        120000.00,
        'CALCULATED',
        'Y',
        '2025-12-01 10:10:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    )
ON CONFLICT (id_shu_period, id_staff) WHERE is_active = 'Y'
DO UPDATE SET
    officer_role_code = EXCLUDED.officer_role_code,
    shu_amount = EXCLUDED.shu_amount,
    distribution_status = EXCLUDED.distribution_status,
    created_by = EXCLUDED.created_by;

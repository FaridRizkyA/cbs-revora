INSERT INTO tbl_staff_grades (
    id_staff_grade,
    grade_code,
    grade_name,
    grade_order,
    description,
    is_active,
    created_date,
    created_by
) VALUES
    (
        '817f61fe-1b8d-4c28-bd11-c6f05eeff8e4',
        'GRD-001',
        'Treasurer',
        3,
        'Staff member responsible for preparing and validating cooperative financial reports.',
        'Y',
        '2026-01-01 08:00:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '88c93555-a679-44fb-9548-e3c4d15e0f47',
        'GRD-002',
        'Chairperson',
        1,
        'Primary cooperative officer who acknowledges operational and financial reports.',
        'Y',
        '2026-01-01 08:00:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '56e7ae45-b8a7-4531-abda-f12f27b688b8',
        'GRD-006',
        'Vice Chairperson',
        2,
        'Deputy cooperative officer included in the SHU structure and officer distribution.',
        'Y',
        '2026-01-01 08:00:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        'b99045b3-891d-49a5-b7f7-b195a35f06ec',
        'GRD-003',
        'Supervisor',
        4,
        'Supervisory officer who acknowledges SHU and other important cooperative reports.',
        'Y',
        '2026-01-01 08:00:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '4ad9a4ff-c9f7-4fa9-8d0a-25730ac9de84',
        'GRD-004',
        'Advisor',
        5,
        'Advisor who can be used as the approving signatory for SHU reports.',
        'Y',
        '2026-01-01 08:00:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '8662e5a7-9785-4925-a764-1ee4f8b9f6fd',
        'GRD-005',
        'Operational Staff',
        6,
        'General operational staff for daily cooperative activities.',
        'Y',
        '2026-01-01 08:00:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    )
ON CONFLICT (id_staff_grade) DO UPDATE SET
    grade_code = EXCLUDED.grade_code,
    grade_name = EXCLUDED.grade_name,
    grade_order = EXCLUDED.grade_order,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    created_by = EXCLUDED.created_by;

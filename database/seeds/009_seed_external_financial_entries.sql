INSERT INTO tbl_external_financial_entries (
    id_external_entry,
    entry_type,
    entry_date,
    entry_source,
    amount,
    notes,
    is_active,
    created_date,
    created_by
) VALUES
    (
        '50d8144d-9ae4-4b27-918a-04d06d117382',
        'INCOME',
        '2026-01-15',
        'MULI',
        1500000.00,
        'Pendapatan kerja sama MULI untuk operasional koperasi.',
        'Y',
        '2026-01-15 10:00:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '3618a00e-702e-4516-85ca-ca588af7dbe2',
        'INCOME',
        '2026-01-16',
        'KOZMA',
        800000.00,
        'Pendapatan kerja sama KOZMA untuk program koperasi mahasiswa.',
        'Y',
        '2026-01-16 10:00:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '9adaa0a2-bb4c-46d5-8658-c99c224a4c2b',
        'OUTCOME',
        '2026-01-20',
        'MAINTENANCE_BANK',
        176000.00,
        'Potongan maintenance bank.',
        'Y',
        '2026-01-20 10:00:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '55555555-5555-4555-8555-555555555555',
        'INCOME',
        '2025-07-01',
        'KANTIN',
        5000000.00,
        'Pendapatan kantin bulan Juni',
        'Y',
        '2025-07-01 10:00:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '66666666-6666-4666-8666-666666666666',
        'OUTCOME',
        '2025-07-15',
        'BIAYA_KANTIN',
        1500000.00,
        'Biaya operasional kantin bulan Juni',
        'Y',
        '2025-07-15 10:00:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    ),
    (
        '77777777-7777-4777-8777-777777777777',
        'INCOME',
        '2026-02-15',
        'SPONSOR',
        3000000.00,
        'Sponsorship event tahunan',
        'Y',
        '2026-02-15 10:00:00',
        '34305b6c-c61f-4247-b2c2-d6ec35a4b2bc'
    )
ON CONFLICT (id_external_entry) DO UPDATE SET
    entry_type = EXCLUDED.entry_type,
    entry_date = EXCLUDED.entry_date,
    entry_source = EXCLUDED.entry_source,
    amount = EXCLUDED.amount,
    notes = EXCLUDED.notes,
    is_active = EXCLUDED.is_active,
    created_by = EXCLUDED.created_by;

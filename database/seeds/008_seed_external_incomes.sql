INSERT INTO tbl_external_incomes (
    id_external_income,
    income_date,
    income_source,
    amount,
    notes,
    is_active,
    created_date,
    created_by
) VALUES
    ('d2f245bd-0647-4a2f-9cd1-60b2ad38ef95', '2026-01-15', 'MULI', 1500000.00, 'Pendapatan kerja sama MULI untuk operasional koperasi.', 'Y', '2026-01-15 10:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10'),
    ('e30356ce-1758-4b30-8de2-71c3be49f0a6', '2026-01-16', 'KOZMA', 800000.00, 'Pendapatan kerja sama KOZMA untuk program koperasi mahasiswa.', 'Y', '2026-01-16 10:00:00', '0f1e2d3c-4b5a-49c8-8d7e-6f5a4b3c2d10')
ON CONFLICT (id_external_income) DO UPDATE SET
    income_date = EXCLUDED.income_date,
    income_source = EXCLUDED.income_source,
    amount = EXCLUDED.amount,
    notes = EXCLUDED.notes,
    is_active = EXCLUDED.is_active,
    created_by = EXCLUDED.created_by;

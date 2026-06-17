INSERT INTO tbl_sales (
    id_sale,
    sale_number,
    id_member,
    id_cashier,
    customer_type,
    subtotal,
    discount_amount,
    total_amount,
    payment_method,
    amount_paid,
    change_amount,
    sale_date,
    notes,
    is_active,
    created_date,
    created_by
) VALUES
    (
        '7a707f99-d9f3-4e2e-91ab-aed33a46c0d4',
        'STO/20260103/S/00001',
        '7ab2edb0-b27c-44bb-bf5e-bfedaa9458b4',
        'c6f1a22e-1f65-4355-be54-69ae3d326457',
        'MEMBER',
        31000.00,
        1000.00,
        30000.00,
        'CASH',
        50000.00,
        20000.00,
        '2026-01-03 09:00:00',
        'Seed sale for stock out document testing',
        'Y',
        '2026-01-03 09:00:00',
        'c6f1a22e-1f65-4355-be54-69ae3d326457'
    ),
    (
        '11111111-1111-4111-8111-111111111111',
        'STO/20250615/S/00001',
        '7ab2edb0-b27c-44bb-bf5e-bfedaa9458b4',
        'c6f1a22e-1f65-4355-be54-69ae3d326457',
        'MEMBER',
        150000.00,
        0.00,
        150000.00,
        'CASH',
        200000.00,
        50000.00,
        '2025-06-15 10:00:00',
        'Historical sale for 24-25 period',
        'Y',
        '2025-06-15 10:00:00',
        'c6f1a22e-1f65-4355-be54-69ae3d326457'
    ),
    (
        '22222222-2222-4222-8222-222222222222',
        'STO/20250820/S/00001',
        'f9294704-b5da-43ab-a9fb-5714a7f67b8f',
        'c6f1a22e-1f65-4355-be54-69ae3d326457',
        'MEMBER',
        250000.00,
        5000.00,
        245000.00,
        'QRIS',
        245000.00,
        0.00,
        '2025-08-20 14:30:00',
        'Historical sale for 24-25 period',
        'Y',
        '2025-08-20 14:30:00',
        'c6f1a22e-1f65-4355-be54-69ae3d326457'
    )
    ,(
        '11112222-3333-4444-5555-000000000101', 'STO/AUTO/S/101', 'f9294704-b5da-43ab-a9fb-5714a7f67b8f', 'c6f1a22e-1f65-4355-be54-69ae3d326457', 'MEMBER', 49000, 0, 49000, 'CASH', 49000, 0, '2026-03-10 10:00:00', 'Auto seeded missing sale', 'Y', '2026-03-10 10:00:00', 'c6f1a22e-1f65-4355-be54-69ae3d326457'
    ),
    (
        '11112222-3333-4444-5555-000000000102', 'STO/AUTO/S/102', 'ff883d77-3386-487f-9f57-0608e0e23981', 'c6f1a22e-1f65-4355-be54-69ae3d326457', 'MEMBER', 49000, 0, 49000, 'CASH', 49000, 0, '2025-05-10 10:00:00', 'Auto seeded missing sale', 'Y', '2025-05-10 10:00:00', 'c6f1a22e-1f65-4355-be54-69ae3d326457'
    ),
    (
        '11112222-3333-4444-5555-000000000103', 'STO/AUTO/S/103', 'ff883d77-3386-487f-9f57-0608e0e23981', 'c6f1a22e-1f65-4355-be54-69ae3d326457', 'MEMBER', 49000, 0, 49000, 'CASH', 49000, 0, '2026-03-10 10:00:00', 'Auto seeded missing sale', 'Y', '2026-03-10 10:00:00', 'c6f1a22e-1f65-4355-be54-69ae3d326457'
    ),
    (
        '11112222-3333-4444-5555-000000000104', 'STO/AUTO/S/104', 'eff12e75-aa83-466a-9f58-3f89ca7f18dc', 'c6f1a22e-1f65-4355-be54-69ae3d326457', 'MEMBER', 49000, 0, 49000, 'CASH', 49000, 0, '2025-06-10 10:00:00', 'Auto seeded missing sale', 'Y', '2025-06-10 10:00:00', 'c6f1a22e-1f65-4355-be54-69ae3d326457'
    ),
    (
        '11112222-3333-4444-5555-000000000105', 'STO/AUTO/S/105', 'eff12e75-aa83-466a-9f58-3f89ca7f18dc', 'c6f1a22e-1f65-4355-be54-69ae3d326457', 'MEMBER', 49000, 0, 49000, 'CASH', 49000, 0, '2026-03-10 10:00:00', 'Auto seeded missing sale', 'Y', '2026-03-10 10:00:00', 'c6f1a22e-1f65-4355-be54-69ae3d326457'
    ),
    (
        '11112222-3333-4444-5555-000000000106', 'STO/AUTO/S/106', 'caa2a8d1-3cfc-43e5-b045-96c56924c6c0', 'c6f1a22e-1f65-4355-be54-69ae3d326457', 'MEMBER', 49000, 0, 49000, 'CASH', 49000, 0, '2025-07-10 10:00:00', 'Auto seeded missing sale', 'Y', '2025-07-10 10:00:00', 'c6f1a22e-1f65-4355-be54-69ae3d326457'
    ),
    (
        '11112222-3333-4444-5555-000000000107', 'STO/AUTO/S/107', 'caa2a8d1-3cfc-43e5-b045-96c56924c6c0', 'c6f1a22e-1f65-4355-be54-69ae3d326457', 'MEMBER', 49000, 0, 49000, 'CASH', 49000, 0, '2026-03-10 10:00:00', 'Auto seeded missing sale', 'Y', '2026-03-10 10:00:00', 'c6f1a22e-1f65-4355-be54-69ae3d326457'
    )
ON CONFLICT (sale_number) DO UPDATE SET
    id_member = EXCLUDED.id_member,
    id_cashier = EXCLUDED.id_cashier,
    customer_type = EXCLUDED.customer_type,
    subtotal = EXCLUDED.subtotal,
    discount_amount = EXCLUDED.discount_amount,
    total_amount = EXCLUDED.total_amount,
    payment_method = EXCLUDED.payment_method,
    amount_paid = EXCLUDED.amount_paid,
    change_amount = EXCLUDED.change_amount,
    sale_date = EXCLUDED.sale_date,
    notes = EXCLUDED.notes,
    is_active = EXCLUDED.is_active,
    created_by = EXCLUDED.created_by;


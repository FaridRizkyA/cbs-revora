INSERT INTO tbl_sale_items (
    id_sale_item,
    id_sale,
    id_product,
    id_product_batch,
    quantity,
    unit_price,
    subtotal,
    is_active,
    created_date,
    created_by
) VALUES
    (
        '3a91e216-09af-4761-a0ab-efcf1f58cc6c',
        '7a707f99-d9f3-4e2e-91ab-aed33a46c0d4',
        '0ca9e2c5-28fe-4568-bb32-5e64f3d81828',
        '794807a4-fb32-4c99-9e99-4a2ece3066f2',
        3,
        7000.00,
        21000.00,
        'Y',
        '2026-01-03 09:00:00',
        'c6f1a22e-1f65-4355-be54-69ae3d326457'
    ),
    (
        '659af12d-5f1c-400b-a7d6-f43048d88e53',
        '7a707f99-d9f3-4e2e-91ab-aed33a46c0d4',
        '811ef873-c921-4b88-a497-129d53b76987',
        'a74cf853-82b6-485d-a7db-5a47f902daf7',
        2,
        5000.00,
        10000.00,
        'Y',
        '2026-01-03 09:00:00',
        'c6f1a22e-1f65-4355-be54-69ae3d326457'
    ),
    (
        '33333333-3333-4333-8333-333333333333',
        '11111111-1111-4111-8111-111111111111',
        '0ca9e2c5-28fe-4568-bb32-5e64f3d81828',
        '794807a4-fb32-4c99-9e99-4a2ece3066f2',
        10,
        15000.00,
        150000.00,
        'Y',
        '2025-06-15 10:00:00',
        'c6f1a22e-1f65-4355-be54-69ae3d326457'
    ),
    (
        '44444444-4444-4444-8444-444444444444',
        '22222222-2222-4222-8222-222222222222',
        '811ef873-c921-4b88-a497-129d53b76987',
        'a74cf853-82b6-485d-a7db-5a47f902daf7',
        50,
        5000.00,
        250000.00,
        'Y',
        '2025-08-20 14:30:00',
        'c6f1a22e-1f65-4355-be54-69ae3d326457'
    )
ON CONFLICT (id_sale_item) DO UPDATE SET
    id_sale = EXCLUDED.id_sale,
    id_product = EXCLUDED.id_product,
    id_product_batch = EXCLUDED.id_product_batch,
    quantity = EXCLUDED.quantity,
    unit_price = EXCLUDED.unit_price,
    subtotal = EXCLUDED.subtotal,
    is_active = EXCLUDED.is_active,
    created_by = EXCLUDED.created_by;


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
        'a1111111-aaaa-4aaa-8aaa-111111111111',
        '91111111-aaaa-4aaa-8aaa-111111111111',
        '8b2c7e46-9fd0-43b8-87e6-5f4b3c2d1e68',
        'b41507df-2869-4c41-9003-e2d4cfba0157',
        3,
        7000.00,
        21000.00,
        'Y',
        '2026-01-03 09:00:00',
        '2b8c7d6e-5f4a-43b2-a1c0-e9f8a7b6c512'
    ),
    (
        'b2222222-bbbb-4bbb-8bbb-222222222222',
        '91111111-aaaa-4aaa-8aaa-111111111111',
        'ad4e9068-b1f2-45da-89a8-7b6d5e4f3a80',
        'd63729f1-4a8b-4e63-8225-a4f6e1dc2379',
        2,
        5000.00,
        10000.00,
        'Y',
        '2026-01-03 09:00:00',
        '2b8c7d6e-5f4a-43b2-a1c0-e9f8a7b6c512'
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


const pool = require("../../config/db");

const toNumber = (value) => Number(value || 0);

const createSaleNumber = () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `SALE-${date}-${time}-${suffix}`;
};

const validatePositiveInteger = (value, fieldName) => {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return number;
};

const getProducts = async (req, res) => {
  const search = String(req.query.search || "").trim();

  try {
    const result = await pool.query(
      `
      WITH stock AS (
        SELECT
          sm.id_product,
          SUM(
            CASE
              WHEN sm.movement_type = 'OUT' THEN -sm.quantity
              ELSE sm.quantity
            END
          )::int AS available_stock
        FROM tbl_stock_movements sm
        WHERE sm.is_active = 'Y'
        GROUP BY sm.id_product
      )
      SELECT
        p.id_product,
        p.product_code,
        p.barcode,
        p.product_name,
        p.description,
        p.selling_price::float AS selling_price,
        p.minimum_stock,
        p.product_image,
        GREATEST(COALESCE(s.available_stock, 0), 0)::int AS available_stock,
        MIN(pb.expired_date) AS nearest_expired_date
      FROM tbl_products p
      LEFT JOIN stock s
        ON s.id_product = p.id_product
      LEFT JOIN tbl_product_batches pb
        ON pb.id_product = p.id_product
        AND pb.is_active = 'Y'
      WHERE p.is_active = 'Y'
        AND (
          $1 = ''
          OR p.product_code ILIKE $2
          OR p.barcode ILIKE $2
          OR p.product_name ILIKE $2
          OR p.description ILIKE $2
        )
      GROUP BY
        p.id_product,
        p.product_code,
        p.barcode,
        p.product_name,
        p.description,
        p.selling_price,
        p.minimum_stock,
        p.product_image,
        s.available_stock
      ORDER BY p.product_name ASC;
      `,
      [search, `%${search}%`]
    );

    res.json({
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch products.",
      error: error.message,
    });
  }
};

const getMembers = async (req, res) => {
  const search = String(req.query.search || "").trim();

  try {
    const result = await pool.query(
      `
      SELECT
        m.id_member,
        m.id_user,
        m.member_code,
        m.full_name,
        m.phone_number,
        m.address,
        m.join_date,
        m.shopping_balance::float AS shopping_balance,
        m.total_spending::float AS total_spending,
        u.username,
        u.email
      FROM tbl_members m
      LEFT JOIN tbl_users u
        ON u.id_user = m.id_user
      WHERE m.is_active = 'Y'
        AND (
          $1 = ''
          OR m.member_code ILIKE $2
          OR m.full_name ILIKE $2
          OR m.phone_number ILIKE $2
          OR u.username ILIKE $2
          OR u.email ILIKE $2
        )
      ORDER BY m.full_name ASC
      LIMIT 25;
      `,
      [search, `%${search}%`]
    );

    res.json({
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch members.",
      error: error.message,
    });
  }
};

const lockProduct = async (client, idProduct) => {
  const result = await client.query(
    `
    SELECT
      id_product,
      product_code,
      product_name,
      selling_price::float AS selling_price
    FROM tbl_products
    WHERE id_product = $1
      AND is_active = 'Y'
    FOR UPDATE;
    `,
    [idProduct]
  );

  if (result.rowCount === 0) {
    throw new Error(`Product not found or inactive: ${idProduct}`);
  }

  return result.rows[0];
};

const getAvailableStock = async (client, idProduct) => {
  const result = await client.query(
    `
    SELECT
      GREATEST(
        COALESCE(
          SUM(
            CASE
              WHEN movement_type = 'OUT' THEN -quantity
              ELSE quantity
            END
          ),
          0
        ),
        0
      )::int AS available_stock
    FROM tbl_stock_movements
    WHERE id_product = $1
      AND is_active = 'Y';
    `,
    [idProduct]
  );

  return result.rows[0].available_stock;
};

const checkoutSale = async (req, res) => {
  const {
    id_cashier,
    id_member,
    payment_method,
    amount_paid,
    discount_amount = 0,
    notes,
    items,
  } = req.body;

  if (!id_cashier) {
    return res.status(400).json({ message: "id_cashier is required." });
  }

  if (!["CASH", "QRIS"].includes(payment_method)) {
    return res.status(400).json({ message: "payment_method must be CASH or QRIS." });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "items must contain at least one item." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const cashierResult = await client.query(
      `
      SELECT id_user
      FROM tbl_users
      WHERE id_user = $1
        AND is_active = 'Y';
      `,
      [id_cashier]
    );

    if (cashierResult.rowCount === 0) {
      throw new Error("Cashier user not found or inactive.");
    }

    let member = null;

    if (id_member) {
      const memberResult = await client.query(
        `
        SELECT id_member
        FROM tbl_members
        WHERE id_member = $1
          AND is_active = 'Y';
        `,
        [id_member]
      );

      if (memberResult.rowCount === 0) {
        throw new Error("Member not found or inactive.");
      }

      member = memberResult.rows[0];
    }

    const saleItems = [];

    for (const item of items) {
      if (!item.id_product) {
        throw new Error("Each item must include id_product.");
      }

      const product = await lockProduct(client, item.id_product);
      const requestedQuantity = validatePositiveInteger(item.quantity || 1, "quantity");
      const unitPrice = toNumber(item.unit_price ?? product.selling_price);

      if (unitPrice < 0) {
        throw new Error(`unit_price cannot be negative for product: ${item.id_product}`);
      }

      const availableStock = await getAvailableStock(client, item.id_product);

      if (requestedQuantity > availableStock) {
        throw new Error(
          `Insufficient stock for product ${product.product_name}. Available: ${availableStock}.`
        );
      }

      saleItems.push({
        id_product: product.id_product,
        id_product_batch: null,
        quantity: requestedQuantity,
        unit_price: unitPrice,
        subtotal: unitPrice * requestedQuantity,
      });
    }

    const subtotal = saleItems.reduce((total, item) => total + item.subtotal, 0);

    const discount = toNumber(discount_amount);
    const totalAmount = subtotal - discount;
    const paidAmount = toNumber(amount_paid);
    const changeAmount = paidAmount - totalAmount;

    if (discount < 0) {
      throw new Error("discount_amount cannot be negative.");
    }

    if (totalAmount < 0) {
      throw new Error("discount_amount cannot exceed subtotal.");
    }

    if (paidAmount < totalAmount) {
      throw new Error("amount_paid cannot be less than total_amount.");
    }

    const saleNumber = createSaleNumber();

    const saleResult = await client.query(
      `
      INSERT INTO tbl_sales (
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
        notes,
        created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      )
      RETURNING
        id_sale,
        sale_number,
        sale_date,
        subtotal::float AS subtotal,
        discount_amount::float AS discount_amount,
        total_amount::float AS total_amount,
        amount_paid::float AS amount_paid,
        change_amount::float AS change_amount;
      `,
      [
        saleNumber,
        member ? member.id_member : null,
        id_cashier,
        member ? "MEMBER" : "GENERAL",
        subtotal,
        discount,
        totalAmount,
        payment_method,
        paidAmount,
        changeAmount,
        notes || null,
        id_cashier,
      ]
    );

    const sale = saleResult.rows[0];
    const insertedItems = [];

    for (const item of saleItems) {
      const saleItemResult = await client.query(
        `
        INSERT INTO tbl_sale_items (
          id_sale,
          id_product,
          id_product_batch,
          quantity,
          unit_price,
          subtotal,
          created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7
        )
        RETURNING
          id_sale_item,
          id_product,
          id_product_batch,
          quantity,
          unit_price::float AS unit_price,
          subtotal::float AS subtotal;
        `,
        [
          sale.id_sale,
          item.id_product,
          item.id_product_batch,
          item.quantity,
          item.unit_price,
          item.subtotal,
          id_cashier,
        ]
      );

      insertedItems.push(saleItemResult.rows[0]);

      await client.query(
        `
        INSERT INTO tbl_stock_movements (
          id_product,
          id_product_batch,
          movement_type,
          quantity,
          reason,
          notes,
          created_by
        ) VALUES (
          $1, $2, 'OUT', $3, $4, $5, $6
        );
        `,
        [
          item.id_product,
          item.id_product_batch,
          item.quantity,
          "SALE",
          `Sale ${sale.sale_number}`,
          id_cashier,
        ]
      );
    }

    if (member) {
      await client.query(
        `
        UPDATE tbl_members
        SET
          total_spending = total_spending + $2,
          last_modify_date = NOW(),
          last_modify_by = $3
        WHERE id_member = $1;
        `,
        [member.id_member, totalAmount, id_cashier]
      );
    }

    await client.query(
      `
      INSERT INTO tbl_activity_logs (
        id_user,
        activity_type,
        table_name,
        record_id,
        description,
        ip_address,
        user_agent,
        created_by
      ) VALUES (
        $1, 'SALE_CHECKOUT', 'tbl_sales', $2, $3, $4, $5, $1
      );
      `,
      [
        id_cashier,
        sale.id_sale,
        `Checkout sale ${sale.sale_number} with ${insertedItems.length} item row(s).`,
        req.ip,
        req.get("user-agent") || null,
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "Checkout completed successfully.",
      data: {
        ...sale,
        id_member: member ? member.id_member : null,
        id_cashier,
        customer_type: member ? "MEMBER" : "GENERAL",
        payment_method,
        items: insertedItems,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    res.status(400).json({
      message: "Checkout failed.",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

module.exports = {
  checkoutSale,
  getMembers,
  getProducts,
};

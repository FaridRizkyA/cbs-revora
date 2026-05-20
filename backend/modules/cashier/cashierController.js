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
      SELECT
        p.id_product,
        p.product_code,
        p.product_name,
        p.description,
        p.selling_price::float AS selling_price,
        p.minimum_stock,
        p.product_image,
        EXISTS (
          SELECT 1
          FROM tbl_product_batches pb
          WHERE pb.id_product = p.id_product
            AND pb.is_active = 'Y'
        ) AS has_inventory_units,
        COUNT(iu.id_inventory_unit)::int AS available_stock,
        MIN(pb.expired_date) FILTER (
          WHERE iu.id_inventory_unit IS NOT NULL
        ) AS nearest_expired_date
      FROM tbl_products p
      LEFT JOIN tbl_product_batches pb
        ON pb.id_product = p.id_product
        AND pb.is_active = 'Y'
      LEFT JOIN tbl_inventory_units iu
        ON iu.id_product_batch = pb.id_product_batch
        AND iu.unit_status = 'AVAILABLE'
        AND iu.is_active = 'Y'
      WHERE p.is_active = 'Y'
        AND (
          $1 = ''
          OR p.product_code ILIKE $2
          OR p.product_name ILIKE $2
          OR p.description ILIKE $2
        )
      GROUP BY
        p.id_product,
        p.product_code,
        p.product_name,
        p.description,
        p.selling_price,
        p.minimum_stock,
        p.product_image
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

const productHasInventoryUnits = async (client, idProduct) => {
  const result = await client.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM tbl_product_batches
      WHERE id_product = $1
        AND is_active = 'Y'
    ) AS has_inventory_units;
    `,
    [idProduct]
  );

  return result.rows[0].has_inventory_units;
};

const lockSpecificInventoryUnit = async (client, idProduct, idInventoryUnit) => {
  const result = await client.query(
    `
    SELECT
      iu.id_inventory_unit,
      iu.id_product,
      iu.id_product_batch,
      iu.barcode,
      pb.expired_date
    FROM tbl_inventory_units iu
    JOIN tbl_product_batches pb
      ON pb.id_product_batch = iu.id_product_batch
    WHERE iu.id_inventory_unit = $1
      AND iu.id_product = $2
      AND iu.is_active = 'Y'
    FOR UPDATE OF iu;
    `,
    [idInventoryUnit, idProduct]
  );

  if (result.rowCount === 0) {
    throw new Error(`Inventory unit not found for product: ${idInventoryUnit}`);
  }

  const unit = result.rows[0];

  const statusResult = await client.query(
    `
    SELECT unit_status
    FROM tbl_inventory_units
    WHERE id_inventory_unit = $1;
    `,
    [idInventoryUnit]
  );

  if (statusResult.rows[0].unit_status !== "AVAILABLE") {
    throw new Error(`Inventory unit is not available: ${unit.barcode}`);
  }

  return unit;
};

const lockAvailableInventoryUnits = async (client, idProduct, quantity) => {
  const result = await client.query(
    `
    SELECT
      iu.id_inventory_unit,
      iu.id_product,
      iu.id_product_batch,
      iu.barcode,
      pb.expired_date
    FROM tbl_inventory_units iu
    JOIN tbl_product_batches pb
      ON pb.id_product_batch = iu.id_product_batch
    WHERE iu.id_product = $1
      AND iu.unit_status = 'AVAILABLE'
      AND iu.is_active = 'Y'
      AND pb.is_active = 'Y'
    ORDER BY pb.expired_date ASC, iu.created_date ASC
    LIMIT $2
    FOR UPDATE OF iu SKIP LOCKED;
    `,
    [idProduct, quantity]
  );

  if (result.rowCount < quantity) {
    throw new Error(`Insufficient stock for product: ${idProduct}`);
  }

  return result.rows;
};

const markInventoryUnitSold = async (client, idInventoryUnit, idCashier) => {
  await client.query(
    `
    UPDATE tbl_inventory_units
    SET
      unit_status = 'SOLD',
      sold_date = NOW(),
      last_modify_date = NOW(),
      last_modify_by = $2
    WHERE id_inventory_unit = $1;
    `,
    [idInventoryUnit, idCashier]
  );
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
    let subtotal = 0;

    for (const item of items) {
      if (!item.id_product) {
        throw new Error("Each item must include id_product.");
      }

      const product = await lockProduct(client, item.id_product);
      const requestedQuantity = validatePositiveInteger(item.quantity || 1, "quantity");
      const unitPrice = toNumber(item.unit_price ?? product.selling_price);
      const hasInventoryUnits = await productHasInventoryUnits(client, item.id_product);

      if (unitPrice < 0) {
        throw new Error(`unit_price cannot be negative for product: ${item.id_product}`);
      }

      if (item.id_inventory_unit) {
        if (requestedQuantity !== 1) {
          throw new Error("quantity must be 1 when id_inventory_unit is provided.");
        }

        const unit = await lockSpecificInventoryUnit(
          client,
          item.id_product,
          item.id_inventory_unit
        );

        saleItems.push({
          id_product: product.id_product,
          id_product_batch: unit.id_product_batch,
          id_inventory_unit: unit.id_inventory_unit,
          quantity: 1,
          unit_price: unitPrice,
          subtotal: unitPrice,
        });

        await markInventoryUnitSold(client, unit.id_inventory_unit, id_cashier);
      } else if (hasInventoryUnits) {
        const units = await lockAvailableInventoryUnits(
          client,
          item.id_product,
          requestedQuantity
        );

        for (const unit of units) {
          saleItems.push({
            id_product: product.id_product,
            id_product_batch: unit.id_product_batch,
            id_inventory_unit: unit.id_inventory_unit,
            quantity: 1,
            unit_price: unitPrice,
            subtotal: unitPrice,
          });

          await markInventoryUnitSold(client, unit.id_inventory_unit, id_cashier);
        }
      } else {
        saleItems.push({
          id_product: product.id_product,
          id_product_batch: null,
          id_inventory_unit: null,
          quantity: requestedQuantity,
          unit_price: unitPrice,
          subtotal: unitPrice * requestedQuantity,
        });
      }
    }

    subtotal = saleItems.reduce((total, item) => total + item.subtotal, 0);

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
          id_inventory_unit,
          quantity,
          unit_price,
          subtotal,
          created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        )
        RETURNING
          id_sale_item,
          id_product,
          id_product_batch,
          id_inventory_unit,
          quantity,
          unit_price::float AS unit_price,
          subtotal::float AS subtotal;
        `,
        [
          sale.id_sale,
          item.id_product,
          item.id_product_batch,
          item.id_inventory_unit,
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
          id_inventory_unit,
          movement_type,
          quantity,
          reason,
          notes,
          created_by
        ) VALUES (
          $1, $2, $3, 'OUT', $4, $5, $6, $7
        );
        `,
        [
          item.id_product,
          item.id_product_batch,
          item.id_inventory_unit,
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

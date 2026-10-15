const pool = require("../../config/db");

const { logActivity } = require("../../utils/activityLogger");
const { enqueueReceiptEmailJob } = require("../emailQueue/emailQueue");
const { toNumber, validatePositiveInteger } = require("./shared/validators");
const { createSaleNumber } = require("./shared/numbering");
const { SIGNED_QUANTITY_SQL } = require("../../utils/stockSql");

const getMembers = async (req, res) => {
  const search = String(req.query.search || "").trim();

  try {
    const result = await pool.query(
      `
      SELECT
        m.id_member,
        m.id_user,
        p.id_profile,
        m.member_code,
        p.first_name,
        p.last_name,
        TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) AS full_name,
        p.phone_number,
        p.address,
        m.join_date,
        m.total_spending::float AS total_spending,
        u.email
      FROM tbl_members m
      LEFT JOIN tbl_profiles p
        ON p.id_user = m.id_user
      LEFT JOIN tbl_users u
        ON u.id_user = m.id_user
      WHERE m.is_active = 'Y'
        AND (
          $1 = ''
          OR m.member_code ILIKE $2
          OR TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) ILIKE $2
          OR p.first_name ILIKE $2
          OR p.last_name ILIKE $2
          OR p.phone_number ILIKE $2
          OR u.email ILIKE $2
        )
      ORDER BY TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) ASC
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

const getAvailableBatches = async (client, idProduct) => {
  const result = await client.query(
    `
    SELECT
      pb.id_product_batch,
      pb.batch_code,
      pb.expired_date,
      GREATEST(
        COALESCE(
          SUM(
            ${SIGNED_QUANTITY_SQL}
          ),
          0
        ),
        0
      )::int AS available_qty
    FROM tbl_product_batches pb
    LEFT JOIN tbl_stock_movements sm
      ON sm.id_product_batch = pb.id_product_batch
     AND sm.is_active = 'Y'
    WHERE pb.id_product = $1
      AND pb.expired_date >= CURRENT_DATE
    GROUP BY pb.id_product_batch, pb.batch_code, pb.expired_date
    HAVING GREATEST(
      COALESCE(
        SUM(
          ${SIGNED_QUANTITY_SQL}
        ),
        0
      ),
      0
    ) > 0
    ORDER BY pb.expired_date ASC NULLS LAST, pb.created_date ASC;
    `,
    [idProduct]
  );

  return result.rows;
};

const checkoutSale = async (req, res) => {
  const {
    id_member,
    payment_method,
    amount_paid,
    discount_amount = 0,
    notes,
    items,
  } = req.body;

  const id_cashier = req.user?.id_user;

  if (!id_cashier) {
    return res.status(401).json({ message: "Authentication required." });
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

    let member = null;
    if (id_member) {
      const memberResult = await client.query(
        `
        SELECT
          m.id_member,
          m.member_code,
          u.email,
          COALESCE(
            NULLIF(TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))), ''),
            u.email,
            '-'
          ) AS member_name
        FROM tbl_members m
        LEFT JOIN tbl_profiles p
          ON p.id_user = m.id_user
        LEFT JOIN tbl_users u
          ON u.id_user = m.id_user
        WHERE m.id_member = $1
          AND m.is_active = 'Y';
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
      // Price always comes from the product master, never from the client.
      const unitPrice = Number(product.selling_price || 0);

      const availableBatches = await getAvailableBatches(client, item.id_product);
      const availableStock = availableBatches.reduce(
        (sum, batch) => sum + Number(batch.available_qty || 0),
        0
      );

      if (requestedQuantity > availableStock) {
        throw new Error(
          `Insufficient stock for product ${product.product_name}. Available (not expired): ${availableStock}.`
        );
      }

      let remainingQty = requestedQuantity;
      for (const batch of availableBatches) {
        if (remainingQty <= 0) break;
        const takeQty = Math.min(remainingQty, Number(batch.available_qty || 0));
        if (takeQty <= 0) continue;

        saleItems.push({
          id_product: product.id_product,
          product_code: product.product_code,
          product_name: product.product_name,
          id_product_batch: batch.id_product_batch,
          quantity: takeQty,
          unit_price: unitPrice,
          subtotal: unitPrice * takeQty,
        });

        remainingQty -= takeQty;
      }

      if (remainingQty > 0) {
        throw new Error(`Failed to allocate batch stock for product ${product.product_name}.`);
      }
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

    const saleNumber = await createSaleNumber(client);

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
          source_type,
          source_id,
          source_item_id,
          created_by
        ) VALUES (
          $1, $2, 'OUT', $3, $4, $5, $6, $7, $8, $9
        );
        `,
        [
          item.id_product,
          item.id_product_batch,
          item.quantity,
          "SALE",
          `Sale ${sale.sale_number}`,
          "SALE",
          sale.id_sale,
          saleItemResult.rows[0].id_sale_item,
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

    await logActivity(client, req, {
      idUser: id_cashier,
      activityType: "SALE_CHECKOUT",
      tableName: "tbl_sales",
      recordId: sale.id_sale,
      description: `Checkout sale ${sale.sale_number} with ${insertedItems.length} item row(s).`,
    });

    await client.query("COMMIT");

    let receiptEmailStatus = "skipped";
    let receiptEmailError = null;

    if (member?.email) {
      try {
        await enqueueReceiptEmailJob({
          idUser: id_cashier,
          saleId: sale.id_sale,
          recipientEmail: member.email,
          subject: `CBS Revora receipt ${sale.sale_number}`,
        });
        receiptEmailStatus = "queued";
      } catch (error) {
        receiptEmailStatus = "failed";
        receiptEmailError = error.message;
        console.warn(`Failed to queue receipt email for ${sale.sale_number}:`, error.message);
      }
    }

    res.status(201).json({
      message: "Checkout completed successfully.",
      data: {
        ...sale,
        id_member: member ? member.id_member : null,
        member_email: member ? member.email || null : null,
        id_cashier,
        customer_type: member ? "MEMBER" : "GENERAL",
        payment_method,
        items: insertedItems,
        receipt_email_status: receiptEmailStatus,
        receipt_email_error: receiptEmailError,
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
  getMembers,
  checkoutSale,
};



const pool = require("../../config/db");
const { logActivity } = require("../../utils/activityLogger");
const { sendReceiptEmail } = require("../../utils/receiptEmail");

const EMAIL_TYPE = "SALE_RECEIPT";
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 60 * 1000;
const POLL_INTERVAL_MS = 2500;

let workerTimer = null;
let workerRunning = false;
let schemaEnsured = false;

const enqueueReceiptEmailJob = async ({ idUser, saleId, recipientEmail, subject }) => {
  await pool.query(
    `
    INSERT INTO tbl_email_logs (
      id_user,
      id_member,
      email_to,
      email_subject,
      email_type,
      email_status,
      reference_table,
      reference_id,
      is_active,
      created_by,
      last_modify_by
    )
    VALUES (
      $1,
      (
        SELECT id_member
        FROM tbl_members
        WHERE id_user = $1
          AND is_active = 'Y'
        LIMIT 1
      ),
      $2,
      $3,
      $4,
      'PENDING',
      'tbl_sales',
      $5,
      'Y',
      $1,
      $1
    );
    `,
    [idUser, recipientEmail, subject, EMAIL_TYPE, saleId]
  );
};

const ensureReceiptEmailQueueSchema = async () => {
  if (schemaEnsured) {
    return;
  }

  await pool.query(`
    ALTER TABLE tbl_email_logs
      ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP;
  `);

  schemaEnsured = true;
};

const loadReceiptEmailJob = async (client) => {
  const result = await client.query(
    `
    WITH next_job AS (
      SELECT
        el.id_email_log,
        el.id_user,
        el.email_to,
        el.email_subject,
        el.reference_id,
        el.attempt_count
      FROM tbl_email_logs el
      WHERE el.is_active = 'Y'
        AND el.email_type = $1
        AND el.email_status = 'PENDING'
        AND (el.next_retry_at IS NULL OR el.next_retry_at <= NOW())
      ORDER BY el.created_date ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    SELECT
      el.id_email_log,
      el.id_user,
      el.email_to,
      el.email_subject,
      el.reference_id,
      el.attempt_count,
      s.id_sale,
      s.sale_number,
      s.sale_date,
      s.payment_method,
      s.amount_paid::float AS amount_paid,
      s.change_amount::float AS change_amount,
      s.discount_amount::float AS discount_amount,
      s.notes,
      m.id_member,
      m.member_code,
      COALESCE(
        NULLIF(TRIM(CONCAT(COALESCE(pm.first_name, ''), ' ', COALESCE(pm.last_name, ''))), ''),
        mu.email,
        '-'
      ) AS member_name,
      mu.email AS member_email,
      COALESCE(
        NULLIF(TRIM(CONCAT(COALESCE(cp.first_name, ''), ' ', COALESCE(cp.last_name, ''))), ''),
        cu.email,
        '-'
      ) AS cashier_name
    FROM next_job el
    JOIN tbl_sales s
      ON s.id_sale = el.reference_id
    LEFT JOIN tbl_members m
      ON m.id_member = s.id_member
    LEFT JOIN tbl_users mu
      ON mu.id_user = m.id_user
    LEFT JOIN tbl_profiles pm
      ON pm.id_profile = m.id_profile
    LEFT JOIN tbl_users cu
      ON cu.id_user = s.id_cashier
    LEFT JOIN tbl_profiles cp
      ON cp.id_user = cu.id_user
     AND cp.is_active = 'Y'
    ;
    `,
    [EMAIL_TYPE]
  );

  return result.rows[0] || null;
};

const loadReceiptEmailItems = async (client, saleId) => {
  const result = await client.query(
    `
    SELECT
      si.id_sale_item,
      p.product_code,
      p.product_name,
      si.quantity,
      si.unit_price::float AS unit_price,
      si.subtotal::float AS subtotal
    FROM tbl_sale_items si
    LEFT JOIN tbl_products p
      ON p.id_product = si.id_product
    WHERE si.id_sale = $1
      AND si.is_active = 'Y'
    ORDER BY si.created_date ASC;
    `,
    [saleId]
  );

  return result.rows;
};

const markReceiptEmailResult = async (client, job, status, reason = null) => {
  const attemptCount = Number(job.attempt_count || 0) + 1;
  const nextRetryAt = status === "PENDING" ? new Date(Date.now() + RETRY_DELAY_MS) : null;

  await client.query(
    `
    UPDATE tbl_email_logs
    SET
      email_status = $2,
      attempt_count = $3,
      failed_reason = $4,
      sent_date = CASE WHEN $2 = 'SENT' THEN NOW() ELSE sent_date END,
      next_retry_at = $5,
      last_modify_date = NOW(),
      last_modify_by = $6
    WHERE id_email_log = $1;
    `,
    [
      job.id_email_log,
      status,
      attemptCount,
      reason,
      nextRetryAt,
      job.id_user,
    ]
  );
};

const processOneReceiptEmailJob = async () => {
  let job = null;
  let items = [];

  // Phase 1: Lock and lease the job using a short-lived transaction
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    job = await loadReceiptEmailJob(client);
    
    if (!job) {
      await client.query("ROLLBACK");
      return false; // Queue empty
    }

    items = await loadReceiptEmailItems(client, job.id_sale);
    
    if (items.length === 0) {
      await markReceiptEmailResult(client, job, "FAILED", "Receipt items were not found.");
      await client.query("COMMIT");
      return true;
    }

    // Acquire lease: increment attempt, set next retry to 1 minute in the future
    await client.query(
      `
      UPDATE tbl_email_logs
      SET
        attempt_count = attempt_count + 1,
        next_retry_at = NOW() + interval '1 minute',
        last_modify_date = NOW(),
        last_modify_by = $2
      WHERE id_email_log = $1;
      `,
      [job.id_email_log, job.id_user]
    );

    // Commit and release immediately so the connection isn't held during PDF generation
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Receipt email worker lease error:", error);
    return false;
  } finally {
    client.release();
  }

  // Phase 2: Do the heavy lifting outside any DB transaction
  try {
    await sendReceiptEmail({
      to: job.email_to,
      saleNumber: job.sale_number,
      saleDate: job.sale_date,
      cashierName: job.cashier_name || "-",
      member: {
        code: job.member_code || null,
        name: job.member_name || job.member_email || "-",
      },
      paymentMethod: job.payment_method,
      amountPaid: Number(job.amount_paid || 0),
      changeAmount: Number(job.change_amount || 0),
      discountAmount: Number(job.discount_amount || 0),
      notes: job.notes || null,
      items: items.map((item) => ({
        productCode: item.product_code || null,
        productName: item.product_name || item.product_code || "-",
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unit_price || 0),
        lineTotal: Number(item.subtotal || 0),
      })),
    });

    // Phase 3a: Success - update status
    await pool.query(
      `
      UPDATE tbl_email_logs
      SET
        email_status = 'SENT',
        sent_date = NOW(),
        failed_reason = NULL,
        next_retry_at = NULL,
        last_modify_date = NOW(),
        last_modify_by = $2
      WHERE id_email_log = $1;
      `,
      [job.id_email_log, job.id_user]
    );

    try {
      await logActivity(pool, null, {
        idUser: job.id_user,
        activityType: "SEND_RECEIPT_EMAIL",
        tableName: "tbl_sales",
        recordId: job.id_sale,
        description: `Sent sale receipt ${job.sale_number} to ${job.email_to}.`,
      });
    } catch (logError) {
      console.warn(`Failed to write receipt email activity for ${job.sale_number}:`, logError.message);
    }

    return true;
  } catch (error) {
    // Phase 3b: Failure - update status
    const isFinalAttempt = (Number(job.attempt_count || 0) + 1) >= MAX_ATTEMPTS;
    const nextStatus = isFinalAttempt ? "FAILED" : "PENDING";
    
    await pool.query(
      `
      UPDATE tbl_email_logs
      SET
        email_status = $2,
        failed_reason = $3,
        last_modify_date = NOW(),
        last_modify_by = $4
      WHERE id_email_log = $1;
      `,
      [job.id_email_log, nextStatus, error.message, job.id_user]
    ).catch(e => console.error("Failed to mark job as failed:", e));

    console.warn(`Receipt email job failed for ${job.sale_number}:`, error.message);
    return true; // Return true to continue processing the queue
  }
};

const startReceiptEmailWorker = () => {
  if (workerTimer) return;

  const tick = async () => {
    if (workerRunning) return;
    workerRunning = true;
    try {
      await ensureReceiptEmailQueueSchema();
      let processed = true;
      while (processed) {
        processed = await processOneReceiptEmailJob();
      }
    } finally {
      workerRunning = false;
    }
  };

  workerTimer = setInterval(() => {
    tick().catch((error) => {
      console.warn("Receipt email worker tick failed:", error.message);
    });
  }, POLL_INTERVAL_MS);

  tick().catch((error) => {
    console.warn("Receipt email worker initial run failed:", error.message);
  });
};

module.exports = {
  EMAIL_TYPE,
  enqueueReceiptEmailJob,
  startReceiptEmailWorker,
};

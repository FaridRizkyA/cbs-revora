const pool = require("../../config/db");
const { logActivity } = require("../../utils/activityLogger");
const { sendReceiptEmail } = require("../../utils/receiptEmail");
const { 
  buildReportPdfFromHtml, 
  buildEmailPdfHtml, 
  buildExcelBuffer, 
  sanitizeAttachmentFileName 
} = require("../../utils/reportUtils");
const { renderTemplate } = require("../../utils/templateRenderer");
const { sendEmail } = require("../../utils/mailer");
const path = require("path");

const EMAIL_TYPES = {
  RECEIPT: "SALE_RECEIPT",
  REPORT: "DATA_REPORT",
};

const MAX_ATTEMPTS = 3;
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
    [idUser, recipientEmail, subject, EMAIL_TYPES.RECEIPT, saleId]
  );
};

const enqueueReportEmailJob = async ({ idUser, payload }) => {
  await pool.query(
    `
    INSERT INTO tbl_email_logs (
      id_user,
      email_to,
      email_subject,
      email_type,
      email_status,
      email_payload,
      is_active,
      created_by,
      last_modify_by
    )
    VALUES ($1, $2, $3, $4, 'PENDING', $5, 'Y', $1, $1);
    `,
    [
      idUser, 
      payload.recipient_email, 
      payload.subject || payload.title || "Data Report", 
      EMAIL_TYPES.REPORT, 
      payload
    ]
  );
};

const ensureEmailQueueSchema = async () => {
  if (schemaEnsured) return;

  await pool.query(`
    ALTER TABLE tbl_email_logs
      ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS email_payload JSONB;
  `);

  try {
    // Try to update the constraint to include DATA_REPORT
    await pool.query(`
      ALTER TABLE tbl_email_logs 
      DROP CONSTRAINT IF EXISTS chk_email_logs_type;
      
      ALTER TABLE tbl_email_logs
      ADD CONSTRAINT chk_email_logs_type 
      CHECK (email_type IN ('SALE_RECEIPT', 'MONTHLY_REPORT', 'SHU_NOTIFICATION', 'DATA_REPORT', 'OTHER'));
    `);
  } catch (e) {
    console.warn("Could not update email type constraint, using OTHER as fallback.");
  }

  schemaEnsured = true;
};

const loadNextEmailJob = async (client) => {
  const result = await client.query(
    `
    SELECT
      id_email_log,
      id_user,
      email_to,
      email_subject,
      email_type,
      email_payload,
      reference_id,
      attempt_count
    FROM tbl_email_logs
    WHERE is_active = 'Y'
      AND email_status = 'PENDING'
      AND (next_retry_at IS NULL OR next_retry_at <= NOW())
    ORDER BY created_date ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;
    `
  );
  return result.rows[0] || null;
};

const loadReceiptData = async (client, saleId) => {
  const [saleResult, itemsResult] = await Promise.all([
    client.query(
      `
      SELECT
        s.id_sale,
        s.sale_number,
        s.sale_date,
        s.payment_method,
        s.amount_paid::float AS amount_paid,
        s.change_amount::float AS change_amount,
        s.discount_amount::float AS discount_amount,
        s.notes,
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
      FROM tbl_sales s
      LEFT JOIN tbl_members m ON m.id_member = s.id_member
      LEFT JOIN tbl_users mu ON mu.id_user = m.id_user
      LEFT JOIN tbl_profiles pm ON pm.id_user = m.id_user
      LEFT JOIN tbl_users cu ON cu.id_user = s.id_cashier
      LEFT JOIN tbl_profiles cp ON cp.id_user = cu.id_user AND cp.is_active = 'Y'
      WHERE s.id_sale = $1
      LIMIT 1;
      `,
      [saleId]
    ),
    client.query(
      `
      SELECT
        p.product_code,
        p.product_name,
        si.quantity,
        si.unit_price::float AS unit_price,
        si.subtotal::float AS subtotal
      FROM tbl_sale_items si
      LEFT JOIN tbl_products p ON p.id_product = si.id_product
      WHERE si.id_sale = $1 AND si.is_active = 'Y'
      ORDER BY si.created_date ASC;
      `,
      [saleId]
    ),
  ]);

  return { sale: saleResult.rows[0], items: itemsResult.rows };
};

const processReceiptJob = async (job) => {
  const { sale, items } = await loadReceiptData(pool, job.reference_id);
  if (!sale || items.length === 0) {
    throw new Error("Sale data or items not found.");
  }

  await sendReceiptEmail({
    to: job.email_to,
    saleNumber: sale.sale_number,
    saleDate: sale.sale_date,
    cashierName: sale.cashier_name || "-",
    member: {
      code: sale.member_code || null,
      name: sale.member_name || sale.member_email || "-",
    },
    paymentMethod: sale.payment_method,
    amountPaid: sale.amount_paid,
    changeAmount: sale.change_amount,
    discountAmount: sale.discount_amount,
    notes: sale.notes || null,
    items: items.map((item) => ({
      productCode: item.product_code,
      productName: item.product_name || item.product_code,
      quantity: Number(item.quantity),
      unitPrice: item.unit_price,
      lineTotal: item.subtotal,
    })),
  });
};

const processReportJob = async (job) => {
  const data = job.email_payload;
  const attachments = [];
  const reportTitle = data.title || "Report";
  const baseFileName = reportTitle.toLowerCase().replace(/\s+/g, "_");

  // 1. Handle PDF
  let pdfBuffer;
  const finalPdfFilename = sanitizeAttachmentFileName(
    data.pdf_filename, 
    `${baseFileName}_${Date.now()}.pdf`
  );

  if (data.pdf_base64) {
    pdfBuffer = Buffer.from(data.pdf_base64, "base64");
  } else if (data.print_html) {
    pdfBuffer = await buildReportPdfFromHtml(data.print_html);
  } else {
    const html = buildEmailPdfHtml({
      title: reportTitle,
      subtitle: data.subtitle || "Generated report",
      generatedAt: new Date().toISOString(),
      generatedBy: data.generated_by,
      meta: data.meta,
      columns: data.columns,
      rows: data.rows,
    });
    pdfBuffer = await buildReportPdfFromHtml(html);
  }

  attachments.push({ 
    filename: finalPdfFilename, 
    content: pdfBuffer, 
    contentType: "application/pdf" 
  });

  // 2. Handle Excel
  if (data.include_excel === true || data.format === "EXCEL") {
    const excelBuffer = await buildExcelBuffer(reportTitle, data.columns, data.rows, data.meta);
    const excelFilename = `${baseFileName}_${Date.now()}.xlsx`;
    attachments.push({
      filename: excelFilename,
      content: excelBuffer,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  const emailHtml = renderTemplate("ReportEmail", {
    TITLE: "Data Report Generated",
    RECIPIENT_NAME: data.recipient_name || job.email_to.split("@")[0],
    REPORT_NAME: reportTitle,
    MESSAGE: data.message || "Please find the attached report file(s) for the requested data.",
  });

  const logoPath = path.join(__dirname, "..", "..", "..", "assets", "images", "ui", "logo_horizontal.png");
  const cbsLogoPath = path.join(__dirname, "..", "..", "..", "assets", "images", "ui", "logo_koperasi_cbs.png");
  
  await sendEmail({
    to: job.email_to,
    subject: job.email_subject,
    html: emailHtml,
    attachments: [
      ...attachments,
      { filename: "logo_cbs.png", path: cbsLogoPath, cid: "cbs-logo" },
      { filename: "logo.png", path: logoPath, cid: "revora-logo" },
    ],
  });
};

const processOneEmailJob = async () => {
  let job = null;

  // Phase 1: Lock and lease
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    job = await loadNextEmailJob(client);
    
    if (!job) {
      await client.query("ROLLBACK");
      return false;
    }

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

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Email worker lease error:", error);
    return false;
  } finally {
    client.release();
  }

  // Phase 2: Execution
  try {
    if (job.email_type === EMAIL_TYPES.RECEIPT) {
      await processReceiptJob(job);
    } else if (job.email_type === EMAIL_TYPES.REPORT) {
      await processReportJob(job);
    } else {
      throw new Error(`Unknown email type: ${job.email_type}`);
    }

    // Phase 3a: Success
    await pool.query(
      `
      UPDATE tbl_email_logs
      SET
        email_status = 'SENT',
        sent_date = NOW(),
        failed_reason = NULL,
        next_retry_at = NULL,
        last_modify_date = NOW()
      WHERE id_email_log = $1;
      `,
      [job.id_email_log]
    );

    return true;
  } catch (error) {
    // Phase 3b: Failure
    const nextStatus = (Number(job.attempt_count || 0) + 1) >= MAX_ATTEMPTS ? "FAILED" : "PENDING";
    
    await pool.query(
      `
      UPDATE tbl_email_logs
      SET
        email_status = $2,
        failed_reason = $3,
        last_modify_date = NOW()
      WHERE id_email_log = $1;
      `,
      [job.id_email_log, nextStatus, error.message]
    ).catch(e => console.error("Failed to mark job as failed:", e));

    console.warn(`Email job failed for ${job.id_email_log}:`, error.message);
    return true;
  }
};

const startEmailWorker = () => {
  if (workerTimer) return;

  const tick = async () => {
    if (workerRunning) return;
    workerRunning = true;
    try {
      await ensureEmailQueueSchema();
      let processed = true;
      while (processed) {
        processed = await processOneEmailJob();
      }
    } finally {
      workerRunning = false;
    }
  };

  workerTimer = setInterval(() => {
    tick().catch((error) => {
      console.warn("Email worker tick failed:", error.message);
    });
  }, POLL_INTERVAL_MS);

  tick().catch((error) => {
    console.warn("Email worker initial run failed:", error.message);
  });
};

module.exports = {
  enqueueReceiptEmailJob,
  enqueueReportEmailJob,
  startEmailWorker,
  EMAIL_TYPES,
};

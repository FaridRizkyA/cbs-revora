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
  SHU: "SHU_NOTIFICATION",
};

const MAX_ATTEMPTS = 3;
const POLL_INTERVAL_MS = 2500;

let workerTimer = null;
let workerRunning = false;
let schemaEnsured = false;

const formatRupiah = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(Number(value || 0))
    .replace(/\s/g, " ");

const formatDateTime = (date) => {
  if (!date) return "-";
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");

  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());

  return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
};

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

const enqueueShuNotificationJobs = async (client, { idShuPeriod, idUser }) => {
  // 1. Members
  const membersResult = await client.query(
    `
    SELECT 
      d.id_shu_distribution,
      u.email,
      p.period_name
    FROM tbl_shu_distributions d
    JOIN tbl_members m ON m.id_member = d.id_member
    JOIN tbl_users u ON u.id_user = m.id_user
    JOIN tbl_shu_periods p ON p.id_shu_period = d.id_shu_period
    WHERE d.id_shu_period = $1
      AND d.is_active = 'Y'
      AND m.is_active = 'Y'
      AND u.is_active = 'Y'
      AND u.email IS NOT NULL
      AND u.email != '';
    `,
    [idShuPeriod]
  );

  for (const row of membersResult.rows) {
    await client.query(
      `
      INSERT INTO tbl_email_logs (
        id_user,
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
        (SELECT id_user FROM tbl_users WHERE email = $1 LIMIT 1),
        $1,
        $2,
        $3,
        'PENDING',
        'tbl_shu_distributions',
        $4,
        'Y',
        $5,
        $5
      );
      `,
      [
        row.email,
        `SHU Distribution Notification - ${row.period_name}`,
        EMAIL_TYPES.SHU,
        row.id_shu_distribution,
        idUser
      ]
    );
  }

  // 2. Officers/Staff
  const officersResult = await client.query(
    `
    SELECT 
      d.id_shu_officer_distribution,
      u.email,
      p.period_name
    FROM tbl_shu_officer_distributions d
    JOIN tbl_staff s ON s.id_staff = d.id_staff
    JOIN tbl_users u ON u.id_user = s.id_user
    JOIN tbl_shu_periods p ON p.id_shu_period = d.id_shu_period
    WHERE d.id_shu_period = $1
      AND d.is_active = 'Y'
      AND s.is_active = 'Y'
      AND u.is_active = 'Y'
      AND u.email IS NOT NULL
      AND u.email != '';
    `,
    [idShuPeriod]
  );

  for (const row of officersResult.rows) {
    await client.query(
      `
      INSERT INTO tbl_email_logs (
        id_user,
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
        (SELECT id_user FROM tbl_users WHERE email = $1 LIMIT 1),
        $1,
        $2,
        $3,
        'PENDING',
        'tbl_shu_officer_distributions',
        $4,
        'Y',
        $5,
        $5
      );
      `,
      [
        row.email,
        `SHU Officer Distribution Notification - ${row.period_name}`,
        EMAIL_TYPES.SHU,
        row.id_shu_officer_distribution,
        idUser
      ]
    );
  }
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
      reference_table,
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
  const saleResult = await client.query(
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
  );

  const itemsResult = await client.query(
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
  );

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
      generatedAt: formatDateTime(new Date()),
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
    let excelBuffer;
    const excelFilename = sanitizeAttachmentFileName(
      data.excel_filename,
      `${baseFileName}_${Date.now()}.xlsx`
    );

    if (data.excel_base64) {
      excelBuffer = Buffer.from(data.excel_base64, "base64");
    } else {
      excelBuffer = await buildExcelBuffer(reportTitle, data.subtitle, data.columns, data.rows, data.meta);
    }

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


const buildShuPdfHtml = (row) => {
  const isMember = row.type === "MEMBER";
  const code = isMember ? row.member_code : row.staff_code;
  
  const CBS_LOGO_URI = require("../../utils/reportUtils").CBS_LOGO_URI;
  const REVORA_LOGO_URI = require("../../utils/reportUtils").REVORA_LOGO_URI;

  let breakdownRows = "";
  if (isMember) {
    breakdownRows = `
      <tr>
        <td class="col-label">Total Member Spending</td>
        <td class="col-value">${formatRupiah(row.member_total_spending)}</td>
      </tr>
      <tr>
        <td class="col-label">Spending Percentage</td>
        <td class="col-value">${(Number(row.spending_percentage) * 100).toFixed(4)}%</td>
      </tr>
      <tr>
        <td class="col-label">Sales SHU Portion</td>
        <td class="col-value">${formatRupiah(row.sales_shu_amount)}</td>
      </tr>
      <tr>
        <td class="col-label">Business SHU Portion</td>
        <td class="col-value">${formatRupiah(row.business_shu_amount)}</td>
      </tr>
    `;
  } else {
    breakdownRows = `
      <tr>
        <td class="col-label">Officer Role</td>
        <td class="col-value">${row.officer_role_code}</td>
      </tr>
    `;
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #000000;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 12px;
        line-height: 1.5;
        background: #ffffff;
      }
      .page { padding: 18mm 16mm; }
      
      /* EXACT MATCH TO ORIGINAL HEADER CSS */
      .report-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        border-bottom: 2px solid #000000;
        padding-bottom: 12px;
        margin-bottom: 20px;
      }
      .brand-logos { display: flex; align-items: center; gap: 10px; }
      .brand-logo-cbs { width: 52px; height: 52px; object-fit: contain; }
      .brand-logo-revora { width: 190px; height: 44px; object-fit: contain; }
      .report-title { font-size: 20px; font-weight: bold; text-align: right; text-transform: uppercase; }
      .report-subtitle { color: #333333; text-align: right; margin-top: 2px; }
      
      /* Professional Slip Styles */
      .section-title {
        font-size: 13px;
        font-weight: bold;
        text-transform: uppercase;
        margin-top: 24px;
        margin-bottom: 8px;
        border-bottom: 1px solid #000000;
        padding-bottom: 4px;
      }
      
      .info-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
      }
      .info-table td {
        padding: 6px 0;
        vertical-align: top;
      }
      .info-label {
        width: 150px;
        font-weight: bold;
        color: #333333;
      }
      .info-value {
        font-weight: normal;
        color: #000000;
      }
      
      .data-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
      }
      .data-table th, .data-table td {
        border: 1px solid #000000;
        padding: 8px 10px;
        vertical-align: top;
      }
      .data-table th {
        background-color: #f2f2f2;
        font-weight: bold;
        text-transform: uppercase;
        font-size: 11px;
        text-align: left;
      }
      .data-table .col-label { width: 60%; }
      .data-table .col-value { width: 40%; text-align: right; }
      
      .total-row td {
        font-weight: bold;
        font-size: 14px;
        background-color: #e6e6e6;
      }
      
      .footer {
        text-align: center;
        color: #555555;
        font-size: 10px;
        border-top: 1px solid #000000;
        padding-top: 10px;
        margin-top: 40px;
      }
      .footer-strong { font-weight: bold; }
    </style>
  </head>
  <body>
    <div class="page">
      <!-- EXACT MATCH TO ORIGINAL HEADER HTML -->
      <header class="report-header">
        <div class="brand-logos">
          ${CBS_LOGO_URI ? `<img class="brand-logo-cbs" src="${CBS_LOGO_URI}" alt="CBS" />` : ""}
          ${REVORA_LOGO_URI ? `<img class="brand-logo-revora" src="${REVORA_LOGO_URI}" alt="Revora" />` : ""}
        </div>
        <div>
          <div class="report-title">${isMember ? "SHU DISTRIBUTION SLIP" : "SHU OFFICER SLIP"}</div>
          <div class="report-subtitle">${row.period_name}</div>
        </div>
      </header>
      
      <div class="section-title">RECIPIENT INFORMATION</div>
      <table class="info-table">
        <tr>
          <td class="info-label">Full Name</td>
          <td class="info-value">: ${row.full_name}</td>
        </tr>
        <tr>
          <td class="info-label">${isMember ? 'Member Code' : 'Staff Code'}</td>
          <td class="info-value">: ${code}</td>
        </tr>
        <tr>
          <td class="info-label">Distribution Date</td>
          <td class="info-value">: ${new Date().toLocaleDateString('en-GB')}</td>
        </tr>
      </table>
      
      <div class="section-title">DISTRIBUTION DETAILS</div>
      <table class="data-table">
        <thead>
          <tr>
            <th class="col-label">Description</th>
            <th class="col-value">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${breakdownRows}
          <tr class="total-row">
            <td class="col-label">TOTAL SHU RECEIVED</td>
            <td class="col-value">${formatRupiah(row.shu_amount)}</td>
          </tr>
        </tbody>
      </table>
      
      <div class="footer">
        This document is an official slip of SHU Distribution.<br>
        Generated automatically by <span class="footer-strong">CBS Revora</span> on ${new Date().toLocaleString('en-GB')}.
      </div>
    </div>
  </body>
</html>`;
};
const processShuNotificationJob = async (job) => {
  let distributionData = null;

  if (job.reference_table === "tbl_shu_distributions") {
    const result = await pool.query(
      `
      SELECT 
        d.id_shu_distribution,
        d.member_total_spending,
        d.spending_percentage,
        d.sales_shu_amount,
        d.business_shu_amount,
        d.shu_amount,
        m.member_code,
        p.period_name,
        p.start_date,
        p.end_date,
        COALESCE(NULLIF(TRIM(CONCAT(COALESCE(pr.first_name, ''), ' ', COALESCE(pr.last_name, ''))), ''), u.email, '-') AS full_name
      FROM tbl_shu_distributions d
      JOIN tbl_members m ON m.id_member = d.id_member
      JOIN tbl_users u ON u.id_user = m.id_user
      LEFT JOIN tbl_profiles pr ON pr.id_user = u.id_user
      JOIN tbl_shu_periods p ON p.id_shu_period = d.id_shu_period
      WHERE d.id_shu_distribution = $1
      LIMIT 1;
      `,
      [job.reference_id]
    );
    distributionData = result.rows[0];
    if (distributionData) {
      distributionData.type = "MEMBER";
    }
  } else if (job.reference_table === "tbl_shu_officer_distributions") {
    const result = await pool.query(
      `
      SELECT 
        d.id_shu_officer_distribution,
        d.shu_amount,
        d.officer_role_code,
        s.staff_code,
        p.period_name,
        p.start_date,
        p.end_date,
        COALESCE(NULLIF(TRIM(CONCAT(COALESCE(pr.first_name, ''), ' ', COALESCE(pr.last_name, ''))), ''), u.email, '-') AS full_name
      FROM tbl_shu_officer_distributions d
      JOIN tbl_staff s ON s.id_staff = d.id_staff
      JOIN tbl_users u ON u.id_user = s.id_user
      LEFT JOIN tbl_profiles pr ON pr.id_user = u.id_user
      JOIN tbl_shu_periods p ON p.id_shu_period = d.id_shu_period
      WHERE d.id_shu_officer_distribution = $1
      LIMIT 1;
      `,
      [job.reference_id]
    );
    distributionData = result.rows[0];
    if (distributionData) {
      distributionData.type = "OFFICER";
    }
  }

  const row = distributionData;
  if (!row) {
    console.error("DEBUG: Failed to find SHU distribution data.");
    console.error("DEBUG: job.reference_table =", job.reference_table);
    console.error("DEBUG: job.reference_id =", job.reference_id);
    
    // Manually run query without JOINs to see if the row exists at all
    if (job.reference_table === "tbl_shu_distributions") {
      const debugRes = await pool.query('SELECT * FROM tbl_shu_distributions WHERE id_shu_distribution = $1', [job.reference_id]);
      console.error("DEBUG: Direct query returned:", debugRes.rows);
    } else {
      const debugRes = await pool.query('SELECT * FROM tbl_shu_officer_distributions WHERE id_shu_officer_distribution = $1', [job.reference_id]);
      console.error("DEBUG: Direct query returned:", debugRes.rows);
    }
    
    throw new Error("SHU distribution data not found.");
  }

  const emailHtml = renderTemplate("ShuNotificationEmail", {
    RECIPIENT_NAME: row.full_name,
    PERIOD_NAME: row.period_name,
    MEMBER_CODE: row.type === "MEMBER" ? row.member_code : row.staff_code,
    TOTAL_SPENDING: row.type === "MEMBER" ? formatRupiah(row.member_total_spending) : "-",
    SHU_AMOUNT: formatRupiah(row.shu_amount),
  });

  const meta = [
    { label: "Name", value: row.full_name },
    { label: row.type === "MEMBER" ? "Member Code" : "Staff Code", value: row.type === "MEMBER" ? row.member_code : row.staff_code },
    { label: "Period", value: row.period_name },
  ];

  const reportRows = [];
  if (row.type === "MEMBER") {
    reportRows.push({ label: "Total Spending", value: formatRupiah(row.member_total_spending) });
    reportRows.push({ label: "Spending Percentage", value: `${(Number(row.spending_percentage) * 100).toFixed(4)}%` });
    reportRows.push({ label: "Sales SHU Amount", value: formatRupiah(row.sales_shu_amount) });
    reportRows.push({ label: "Business SHU Amount", value: formatRupiah(row.business_shu_amount) });
  } else {
    reportRows.push({ label: "Officer Role", value: row.officer_role_code });
  }
  reportRows.push({ label: "Total SHU Received", value: formatRupiah(row.shu_amount) });

  const pdfHtml = buildShuPdfHtml(row);

  const pdfBuffer = await buildReportPdfFromHtml(pdfHtml);
  const code = row.type === "MEMBER" ? row.member_code : row.staff_code;
  const attachmentName = sanitizeAttachmentFileName(`SHU_Slip_${code}_${row.period_name}.pdf`);
  const logoPath = path.join(__dirname, "..", "..", "..", "assets", "images", "ui", "logo_horizontal.png");
  const cbsLogoPath = path.join(__dirname, "..", "..", "..", "assets", "images", "ui", "logo_koperasi_cbs.png");

  await sendEmail({
    to: job.email_to,
    subject: job.email_subject,
    html: emailHtml,
    attachments: [
      { filename: attachmentName, content: pdfBuffer, contentType: "application/pdf" },
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
    } else if (job.email_type === EMAIL_TYPES.SHU) {
      await processShuNotificationJob(job);
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
  enqueueShuNotificationJobs,
  startEmailWorker,
  EMAIL_TYPES,
};

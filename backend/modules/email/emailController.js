const path = require("path");
const { 
  buildExcelBuffer, 
  sanitizeAttachmentFileName,
  buildReportPdfFromHtml,
  buildEmailPdfHtml
} = require("../../utils/reportUtils");
const { enqueueReportEmailJob } = require("../emailQueue/emailQueue");

const sendEmailReport = async (req, res) => {
  const { 
    recipient_email, 
    format, 
    pdf_base64, 
    columns, 
    rows 
  } = req.body;

  if (!recipient_email || !format) {
    return res.status(400).json({ message: "recipient_email and format are required." });
  }

  if (!pdf_base64 && (!columns || !rows)) {
    return res.status(400).json({ message: "columns and rows are required when no PDF attachment is provided." });
  }

  try {
    await enqueueReportEmailJob({
      idUser: req.user.id_user,
      payload: req.body
    });

    res.json({ message: "Report has been queued for delivery." });
  } catch (error) {
    console.error("Email queue error:", error);
    res.status(500).json({ message: "Failed to queue report.", error: error.message });
  }
};

const exportExcelReport = async (req, res) => {
  const { title, subtitle, columns, rows, meta, file_name } = req.body;
  if (!Array.isArray(columns) || !Array.isArray(rows)) {
    return res.status(400).json({ message: "columns and rows are required." });
  }

  try {
    const buffer = await buildExcelBuffer(title || "Report", subtitle, columns, rows, meta);
    const filename = sanitizeAttachmentFileName(file_name, `${(title || "report").toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.xlsx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Excel export error:", error);
    res.status(500).json({ message: "Failed to export Excel.", error: error.message });
  }
};

const exportPdfReport = async (req, res) => {
  const { title, subtitle, meta, columns, rows, print_html, file_name, generated_by } = req.body;

  try {
    let pdfBuffer;
    if (print_html) {
      pdfBuffer = await buildReportPdfFromHtml(print_html);
    } else {
      const html = buildEmailPdfHtml({
        title: title || "Report",
        subtitle: subtitle || "Generated report",
        generatedAt: new Date().toISOString(),
        generatedBy: generated_by,
        meta,
        columns,
        rows,
      });
      pdfBuffer = await buildReportPdfFromHtml(html);
    }

    const filename = sanitizeAttachmentFileName(file_name, `${(title || "report").toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.pdf`);
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error("PDF export error:", error);
    res.status(500).json({ message: "Failed to export PDF.", error: error.message });
  }
};

module.exports = { 
  sendEmailReport, 
  exportExcelReport,
  exportPdfReport,
  // Exporting these for emailQueue to use without circular dependency
  buildExcelBuffer,
  sanitizeAttachmentFileName
};

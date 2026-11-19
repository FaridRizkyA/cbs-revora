const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: process.env.MAIL_PORT === "465", // true for 465, false for other ports (like 587)
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD,
  },
});

const guessMimeType = (filename = "", fallback = "application/octet-stream") => {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return fallback;
};

const serializeAttachments = (attachments = []) =>
  attachments.map((item) => {
    let base64 = "";
    if (Buffer.isBuffer(item.content)) {
      base64 = item.content.toString("base64");
    } else if (typeof item.content === "string") {
      base64 = Buffer.from(item.content, item.encoding || "utf8").toString("base64");
    } else if (item.path) {
      base64 = fs.readFileSync(item.path).toString("base64");
    }

    return {
      filename: item.filename || "attachment",
      contentType: item.contentType || guessMimeType(item.filename),
      cid: item.cid || null,
      base64,
    };
  });

const sendViaGoogleAppsScript = async ({ to, subject, text, html, attachments }) => {
  const response = await fetch(process.env.GOOGLE_SCRIPT_MAIL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    redirect: "follow",
    body: JSON.stringify({
      secret: process.env.GOOGLE_SCRIPT_MAIL_SECRET || "",
      fromName: process.env.MAIL_FROM_NAME || "CBS Revora Support",
      to,
      subject,
      text: text || "",
      html: html || "",
      attachments: serializeAttachments(attachments),
    }),
  });

  const rawText = await response.text();
  let result;
  try {
    result = JSON.parse(rawText);
  } catch {
    throw new Error(`Google Apps Script returned non-JSON (${response.status}): ${rawText.slice(0, 180)}`);
  }

  if (!response.ok || result.ok === false) {
    throw new Error(result.error || `Google Apps Script error (${response.status})`);
  }

  console.log("Message sent via Google Apps Script to %s", to);
  return result;
};

const sendEmail = async ({ to, subject, text, html, attachments }) => {
  try {
    if (process.env.GOOGLE_SCRIPT_MAIL_URL) {
      return await sendViaGoogleAppsScript({ to, subject, text, html, attachments });
    }

    const info = await transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
      to,
      subject,
      text,
      html,
      attachments,
    });
    console.log("Message sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

module.exports = { sendEmail };

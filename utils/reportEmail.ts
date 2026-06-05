import * as Print from "expo-print";
import { Platform } from "react-native";

type ReportEmailPayload = {
  format: string;
  title?: string;
  print_html?: string;
  pdf_filename?: string;
  [key: string]: unknown;
};

const buildEmailPdfFileName = (title?: string) => {
  const safeTitle = String(title || "report")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "");

  return `${safeTitle || "report"}_${Date.now()}.pdf`;
};

export const withEmailPdfAttachment = async <Payload extends ReportEmailPayload>(payload: Payload) => {
  if (payload.format !== "PDF" || !payload.print_html) {
    return payload;
  }

  if (Platform.OS === "web") {
    return payload;
  }

  const { print_html, ...payloadWithoutHtml } = payload;
  const result = await Print.printToFileAsync({
    html: print_html,
    base64: true,
  });

  if (!result.base64) {
    throw new Error("Failed to generate email PDF attachment.");
  }

  return {
    ...payloadWithoutHtml,
    pdf_base64: result.base64,
    pdf_filename: payload.pdf_filename || buildEmailPdfFileName(payload.title),
  };
};

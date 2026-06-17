import { Platform } from "react-native";
import * as Print from "expo-print";
import { downloadReportPdf } from "./pdfExport";
import { logClientActivity } from "./activityLog";

type PrintOptions = {
  tableName?: string;
  description?: string;
  fileName?: string;
  activityType?: "PRINT_REPORT" | "PRINT_RECEIPT";
};

export const printReportHtml = async (html: string, options: PrintOptions = {}) => {
  const { 
    tableName, 
    description = "Printed report.", 
    fileName, 
    activityType = "PRINT_REPORT" 
  } = options;

  await logClientActivity({
    activityType,
    tableName,
    description,
  });

  // Use direct download/share for all platforms ("Export as PDF" intent)
  const success = await downloadReportPdf({
    title: description,
    print_html: html,
    file_name: fileName,
  });

  if (!success) {
    throw new Error("Failed to export PDF report.");
  }
};

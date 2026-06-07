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

  if (Platform.OS === "web") {
    try {
      // Try direct download first for better user experience (automatic filename)
      const success = await downloadReportPdf({
        title: description,
        print_html: html,
        file_name: fileName,
      });
      if (success) return;
    } catch (err) {
      console.warn("Direct PDF download failed, falling back to print window:", err);
    }

    if (typeof window === "undefined") return;

    const printWindow = window.open("", "_blank", "width=1024,height=720");
    if (!printWindow) {
      throw new Error("Please allow pop-ups to print this report.");
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.setTimeout(() => {
      printWindow.print();
    }, 250);
    return;
  }

  // Native mobile print dialog
  await Print.printAsync({ html });
};

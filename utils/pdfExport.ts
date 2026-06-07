import { Platform } from "react-native";
import { fetchWithAuth } from "./fetchWithAuth";

type PdfExportPayload = {
  title: string;
  subtitle?: string;
  meta?: { label: string; value: any }[];
  columns?: { key: string; title: string; align?: string }[];
  rows?: any[];
  print_html?: string;
  file_name?: string;
  generated_by?: string | null;
};

export const downloadReportPdf = async (payload: PdfExportPayload) => {
  if (Platform.OS !== "web") {
    // For native, we still rely on the print dialog as it's the standard way to "save as PDF"
    // and handles the file system and sharing intent better.
    return false;
  }

  try {
    const response = await fetchWithAuth("/api/reports/export-pdf", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Failed to generate PDF for download.");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    // Use provided filename or fallback
    const fileName = payload.file_name || `${payload.title.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.pdf`;
    link.setAttribute("download", fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
    
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error("PDF Download Error:", error);
    throw error;
  }
};

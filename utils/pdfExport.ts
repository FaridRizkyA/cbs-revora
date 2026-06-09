import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
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

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const downloadReportPdf = async (payload: PdfExportPayload) => {
  const fileName = payload.file_name || `${payload.title.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.pdf`;
  const safeFileName = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;

  if (Platform.OS !== "web") {
    try {
      let uri: string;

      if (payload.print_html) {
        const result = await Print.printToFileAsync({ html: payload.print_html });
        uri = result.uri;
      } else {
        const response = await fetchWithAuth("/api/reports/export-pdf", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error("Failed to generate PDF for download.");
        }

        const blob = await response.blob();
        const base64 = await blobToBase64(blob);

        uri = `${FileSystem.cacheDirectory}${safeFileName}`;
        await FileSystem.writeAsStringAsync(uri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      // Ensure the file has the correct name for sharing
      const finalUri = `${FileSystem.cacheDirectory}${safeFileName}`;
      if (uri !== finalUri) {
        await FileSystem.moveAsync({
          from: uri,
          to: finalUri,
        });
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(finalUri, {
          mimeType: "application/pdf",
          dialogTitle: payload.title,
          UTI: "com.adobe.pdf",
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error("PDF Export Error (Native):", error);
      throw error;
    }
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
    link.setAttribute("download", safeFileName);
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

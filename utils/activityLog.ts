import { fetchWithAuth } from "./fetchWithAuth";
import { getAuthSession } from "./authSession";

type ClientActivityType = "PRINT_REPORT" | "PRINT_RECEIPT" | "EXPORT_REPORT" | "EXPORT_EXCEL" | "SEND_REPORT_EMAIL";

type LogClientActivityOptions = {
  activityType: ClientActivityType;
  tableName?: string | null;
  recordId?: string | null;
  description?: string | null;
};

export const logClientActivity = async ({
  activityType,
  tableName,
  recordId,
  description,
}: LogClientActivityOptions) => {
  try {
    const session = await getAuthSession();
    await fetchWithAuth("/api/activity-logs/client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_user: session?.user?.id_user || null,
        activity_type: activityType,
        table_name: tableName || null,
        record_id: recordId || null,
        description: description || null,
      }),
    });
  } catch {
    // Logging must not block the user's primary action.
  }
};

export const formatActivityTypeLabel = (value?: string | null) => {
  if (!value) return "-";
  return String(value).replace(/_/g, " ");
};

import { formatDisplayDate, formatDisplayDateTime } from "../../utils/dateFormat";

export const formatRupiah = (value: number | undefined) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(value || 0)
    .replace(/\s/g, " ");

export const formatPercent = (value: number | undefined) => `${((value || 0) * 100).toFixed(2)}%`;

export const formatDate = (value: string | undefined) => formatDisplayDate(value);

export const formatDateTime = (value: string | undefined) => formatDisplayDateTime(value);

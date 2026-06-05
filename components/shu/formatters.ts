export const formatRupiah = (value: number | undefined) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(value || 0)
    .replace(/\s/g, " ");

export const formatPercent = (value: number | undefined) => `${((value || 0) * 100).toFixed(2)}%`;

export const formatDate = (value: string | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID");
};

export const formatDateTime = (value: string | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID").replace(/:/g, ".");
};

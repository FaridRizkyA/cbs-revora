const generateNextSupplierCode = async (client) => {
  const result = await client.query(
    `
    SELECT
      COALESCE(
        MAX(
          CASE
            WHEN supplier_code ~ '^SUP-[0-9]+$'
              THEN CAST(SUBSTRING(supplier_code FROM 5) AS INTEGER)
            ELSE NULL
          END
        ),
        0
      ) AS max_seq
    FROM tbl_suppliers;
    `
  );
  const nextSeq = Number(result.rows[0]?.max_seq || 0) + 1;
  return `SUP-${String(nextSeq).padStart(3, "0")}`;
};

const buildProductCodeBaseFromName = (productNameRaw) => {
  const name = String(productNameRaw || "").trim().toUpperCase();
  const tokens = name.split(/\s+/).filter(Boolean);
  const consonantTokens = tokens
    .map((token) => token.replace(/[^A-Z0-9]/g, ""))
    .map((token) => {
      if (!token) return "";
      const first = token[0];
      const rest = token.slice(1).replace(/[AEIOU]/g, "");
      if (/[AEIOU]/.test(first)) return `${first}${rest}`;
      return token.replace(/[AEIOU]/g, "");
    })
    .filter(Boolean);
  const compact = consonantTokens.join("-");
  return `PRD-${compact || "ITEM"}`;
};

const generateNextProductCode = async (client, productName) => {
  const baseCode = buildProductCodeBaseFromName(productName);
  let attempt = 0;

  while (attempt < 9999) {
    const candidate = attempt === 0 ? baseCode : `${baseCode}-${attempt + 1}`;
    const exists = await client.query(
      `SELECT 1 FROM tbl_products WHERE UPPER(TRIM(product_code)) = $1 LIMIT 1;`,
      [candidate]
    );
    if (exists.rowCount === 0) return candidate;
    attempt += 1;
  }

  throw new Error("Failed to generate unique product_code.");
};

module.exports = {
  generateNextSupplierCode,
  generateNextProductCode,
};

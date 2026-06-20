const createSaleNumber = async (client) => {
  const seqResult = await client.query(
    `
    SELECT
      TO_CHAR(NOW(), 'YYYYMMDD') AS date_token,
      LPAD((COUNT(*) + 1)::text, 5, '0') AS seq
    FROM tbl_sales
    WHERE sale_date::date = CURRENT_DATE;
    `
  );
  const row = seqResult.rows[0];
  return `STO/${row.date_token}/S/${row.seq}`;
};

const createStockInCode = async (client) => {
  const seqResult = await client.query(
    `
    SELECT
      TO_CHAR(NOW(), 'YYYYMMDD') AS date_token,
      LPAD((COUNT(*) + 1)::text, 5, '0') AS seq
    FROM tbl_stock_in_headers
    WHERE stock_in_date::date = CURRENT_DATE;
    `
  );
  const row = seqResult.rows[0];
  return `STI/${row.date_token}/${row.seq}`;
};

module.exports = {
  createSaleNumber,
  createStockInCode,
};

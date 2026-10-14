// Advisory locks serialize number generation until the surrounding transaction ends,
// so two checkouts on the same day cannot read the same COUNT and collide on UNIQUE.
const SALE_NUMBER_LOCK_KEY = 830101;
const STOCK_IN_CODE_LOCK_KEY = 830102;

const createSaleNumber = async (client) => {
  await client.query(`SELECT pg_advisory_xact_lock($1);`, [SALE_NUMBER_LOCK_KEY]);
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
  await client.query(`SELECT pg_advisory_xact_lock($1);`, [STOCK_IN_CODE_LOCK_KEY]);
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

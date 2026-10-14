// Seeds SHU period 2024-2025 (Dec 2024 - Nov 2025) so the app's SHU calculation
// reproduces "DATA KEUNTUNGAN & PEMBAGIAN SHU KOPERASI 2025.xlsx", then verifies it
// against the Excel values using the real backend calculation (shuController).
//
// Usage: npm run db:testSHU
// Re-runnable: data from a previous run (marked with SHU25 / [testSHU]) is removed first.

const path = require("path");
const { Pool } = require("pg");

require("dotenv").config({ path: path.join(__dirname, "../../backend/.env") });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// ---------------------------------------------------------------------------
// Excel reference data
// ---------------------------------------------------------------------------

const PERIOD = { name: "SHU 2024-2025", start: "2024-12-01", end: "2025-11-30" };

// Sheet1 rows 36-56. Red rows (Purwadi, Dariyono) are inactive members.
const MEMBERS = [
  { name: "Acep", spending: 1975750, active: true },
  { name: "Farizal Marzuki", spending: 921600, active: true },
  { name: "Imelda M", spending: 1942500, active: true },
  { name: "Purwadi", spending: 100000, active: false },
  { name: "Nurul Hidayah", spending: 2578400, active: true },
  { name: "Dariyono Abdul Ghofar", spending: 275000, active: false },
  { name: "R.Windu Laksono", spending: 1019400, active: true },
  { name: "Nova Nila Krisna", spending: 1286340, active: true },
  { name: "Syukri Agam", spending: 1100000, active: true },
  { name: "M. Rizki", spending: 370500, active: true },
  { name: "Rini Yulianti", spending: 1100000, active: true },
  { name: "Anggara Setiawan", spending: 2416700, active: true },
  { name: "Herman", spending: 1100000, active: true },
  { name: "Agnesia Rahma", spending: 1100000, active: true },
  { name: "Yusra", spending: 525300, active: true },
  { name: "Dwi Handayani", spending: 883150, active: true },
  { name: "Chandra", spending: 951000, active: true },
  { name: "Athala", spending: 1589650, active: true },
  { name: "Lutfi", spending: 1236900, active: true },
  { name: "Aisyah", spending: 1100000, active: true },
  { name: "Muhammad Ridwansyah", spending: 1197000, active: true },
];

// Sheet1 C29:C31, C59, C62:C64 and Sheet2 C38.
const EXCEL = {
  salesShuTotal: 4897588,
  businessShuPool: 3843532.1,
  businessShuPerMember: 3843532.1 / 19,
  memberShuTotal: 8741120.1,
  managerFund: 971235.6,
  officerShare: 323745.2,
  totalIncome: 17527180, // Sheet2 C13
  totalExpense: 7814824, // Sheet1 H21
};

// Sheet2 "usaha" income rows, recorded as External Financial INCOME.
const BUSINESS_INCOMES = [
  { date: "2025-10-31", source: "Bagi Hasil Pulsa", amount: 423981, notes: "Keuntungan bagi hasil pulsa Des - Okt" },
  { date: "2025-08-29", source: "Pinjaman", amount: 1130000, notes: "Keuntungan pinjaman" },
  { date: "2025-03-14", source: "PIN English", amount: 249000, notes: "Keuntungan penjualan PIN English" },
  { date: "2025-07-18", source: "Jahit Seragam", amount: 1260000, notes: "Keuntungan jahit seragam" },
  { date: "2025-09-12", source: "Lanyard", amount: 268000, notes: "Keuntungan lanyard" },
  {
    date: "2025-11-10",
    source: "Pengembalian Penyusutan Aset",
    amount: 4950000,
    notes: "Pengembalian penyusutan aset 24 bulan dari pot simpanan anggota lama",
  },
];

// Sheet1 G14:H20. The rejected goods row becomes a stock out (sales lane cost),
// every other row is an External Financial OUTCOME (business lane expense).
const REJECTED_GOODS_LOSS = 2747824;
const BUSINESS_EXPENSES = [
  { date: "2025-11-25", source: "Uang Makan Farhan", amount: 900000, notes: "Uang makan Farhan" },
  { date: "2025-11-25", source: "Pot. Maintenance Bank", amount: 176000, notes: "Potongan maintenance bank" },
  { date: "2025-06-20", source: "Bensin & Parkir", amount: 118000, notes: "Bensin & parkir belanja natura" },
  { date: "2025-11-28", source: "Biaya Penyusutan Toko", amount: 1960000, notes: "Biaya penyusutan toko" },
  { date: "2025-04-16", source: "Service Showcase", amount: 220000, notes: "Service showcase" },
  { date: "2025-11-28", source: "Pengurangan Penyusutan Aset", amount: 1693000, notes: "Pengurangan penyusutan aset" },
];

const MARK = "[testSHU]";
const CODE_PREFIX = "SHU25-";
const SUPPLIER_CODE = "SUP-SHU25";
const EMAIL_SUFFIX = ".shu2025@cbsrevora.local";
// bcrypt hash of "Password123", same as database/seeds/002_seed_users.sql
const PASSWORD_HASH = "$2b$10$RC8C.90Ig5tZ3ocKa.voiebbPFNXoCCY22vT/idXuh8uD26LrvbDe";

// ---------------------------------------------------------------------------
// Derived amounts (integer cents, columns are NUMERIC(15,2))
// ---------------------------------------------------------------------------

const toCents = (n) => Math.round(n * 100);
const fromCents = (c) => (c / 100).toFixed(2);
const sumCents = (rows) => rows.reduce((s, r) => s + toCents(r.amount), 0);

// The app pays business SHU from 90% of the business net and the managers get
// 10% of each lane net, so both nets are pinned by the Excel payouts.
const businessNetCents = Math.round(toCents(EXCEL.businessShuPool) / 0.9); // 4.270.591,22
const combinedNetCents = Math.round(toCents(EXCEL.managerFund) / 0.1); // 9.712.356,00
const salesNetCents = combinedNetCents - businessNetCents; // 5.441.764,78

const salesCostCents = toCents(REJECTED_GOODS_LOSS);
const salesMarginCents = salesNetCents + salesCostCents; // gross margin of all member sales
const businessExpenseCents = sumCents(BUSINESS_EXPENSES);
// The gap between the Excel "usaha" rows and the required business income is booked
// as Kado Famgath, which Excel lumps into "Keuntungan Penjualan Barang + Kado Famgath".
const kadoFamgathCents = businessNetCents + businessExpenseCents - sumCents(BUSINESS_INCOMES);

const totalSpendingCents = MEMBERS.reduce((s, m) => s + toCents(m.spending), 0);

// Spread the gross margin across member products proportionally to their price.
const marginsCents = (() => {
  let allocated = 0;
  return MEMBERS.map((m, i) => {
    if (i === MEMBERS.length - 1) return salesMarginCents - allocated;
    const c = Math.round((toCents(m.spending) * salesMarginCents) / totalSpendingCents);
    allocated += c;
    return c;
  });
})();

// Sale dates spread over the period. Inactive members shop early, before deactivation.
const MONTHS = ["2024-12", "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11"];
const saleDateFor = (member, index) => {
  if (member.name === "Purwadi") return "2024-12-10";
  if (member.name === "Dariyono Abdul Ghofar") return "2025-01-15";
  const day = String(3 + ((index * 7) % 24)).padStart(2, "0");
  return `${MONTHS[index % MONTHS.length]}-${day}`;
};

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

const one = async (client, sql, params) => (await client.query(sql, params)).rows[0];

const nextDailyCode = async (client, table, column, dateColumn, date, build) => {
  const row = await one(
    client,
    `SELECT COUNT(*)::int AS total FROM ${table} WHERE ${dateColumn}::date = $1::date`,
    [date]
  );
  return build(date.replace(/-/g, ""), String(row.total + 1).padStart(5, "0"));
};

const cleanup = async (client) => {
  const ids = async (sql, params) => (await client.query(sql, params)).rows.map((r) => r.id);

  const userIds = await ids(`SELECT id_user AS id FROM tbl_users WHERE email LIKE $1`, [`%${EMAIL_SUFFIX}`]);
  const memberIds = await ids(`SELECT id_member AS id FROM tbl_members WHERE id_user = ANY($1::uuid[])`, [userIds]);
  const productIds = await ids(`SELECT id_product AS id FROM tbl_products WHERE product_code LIKE $1`, [`${CODE_PREFIX}%`]);
  const saleIds = await ids(
    `SELECT DISTINCT id_sale AS id FROM tbl_sale_items WHERE id_product = ANY($1::uuid[])
     UNION SELECT id_sale FROM tbl_sales WHERE id_member = ANY($2::uuid[])`,
    [productIds, memberIds]
  );
  const periodIds = await ids(`SELECT id_shu_period AS id FROM tbl_shu_periods WHERE period_name = $1`, [PERIOD.name]);

  await client.query(`DELETE FROM tbl_email_logs WHERE id_member = ANY($1::uuid[]) OR id_user = ANY($2::uuid[])`, [memberIds, userIds]);
  await client.query(`DELETE FROM tbl_shu_distributions WHERE id_shu_period = ANY($1::uuid[]) OR id_member = ANY($2::uuid[])`, [periodIds, memberIds]);
  await client.query(`DELETE FROM tbl_shu_officer_distributions WHERE id_shu_period = ANY($1::uuid[])`, [periodIds]);
  await client.query(`DELETE FROM tbl_shu_periods WHERE id_shu_period = ANY($1::uuid[])`, [periodIds]);

  await client.query(`DELETE FROM tbl_stock_movements WHERE id_product = ANY($1::uuid[])`, [productIds]);
  await client.query(`DELETE FROM tbl_sale_items WHERE id_sale = ANY($1::uuid[])`, [saleIds]);
  await client.query(`DELETE FROM tbl_sales WHERE id_sale = ANY($1::uuid[])`, [saleIds]);
  await client.query(`DELETE FROM tbl_stock_in_items WHERE id_product = ANY($1::uuid[])`, [productIds]);
  await client.query(
    `DELETE FROM tbl_stock_in_headers h
     WHERE h.id_supplier IN (SELECT id_supplier FROM tbl_suppliers WHERE supplier_code = $1)
       AND NOT EXISTS (SELECT 1 FROM tbl_stock_in_items i WHERE i.id_stock_in = h.id_stock_in)`,
    [SUPPLIER_CODE]
  );
  await client.query(`DELETE FROM tbl_product_batches WHERE id_product = ANY($1::uuid[])`, [productIds]);
  await client.query(`DELETE FROM tbl_products WHERE id_product = ANY($1::uuid[])`, [productIds]);
  await client.query(`DELETE FROM tbl_suppliers WHERE supplier_code = $1`, [SUPPLIER_CODE]);
  await client.query(`DELETE FROM tbl_external_financial_entries WHERE notes LIKE $1`, [`${MARK}%`]);

  await client.query(`DELETE FROM tbl_activity_logs WHERE id_user = ANY($1::uuid[]) OR created_by = ANY($1::uuid[])`, [userIds]);
  await client.query(`DELETE FROM tbl_password_reset_otps WHERE id_user = ANY($1::uuid[])`, [userIds]);
  await client.query(`DELETE FROM tbl_members WHERE id_member = ANY($1::uuid[])`, [memberIds]);
  await client.query(`DELETE FROM tbl_user_roles WHERE id_user = ANY($1::uuid[])`, [userIds]);
  await client.query(`DELETE FROM tbl_profiles WHERE id_user = ANY($1::uuid[])`, [userIds]);
  await client.query(`DELETE FROM tbl_users WHERE id_user = ANY($1::uuid[])`, [userIds]);

  return { members: memberIds.length, products: productIds.length, sales: saleIds.length };
};

// Any other data inside the period would change the SHU result, so stop early.
const assertPeriodIsClean = async (client) => {
  const row = await one(
    client,
    `SELECT
       (SELECT COUNT(*)::int FROM tbl_members WHERE is_active = 'Y') AS active_members,
       (SELECT COUNT(*)::int FROM tbl_sales WHERE is_active = 'Y' AND sale_date::date BETWEEN $1 AND $2) AS sales,
       (SELECT COUNT(*)::int FROM tbl_external_financial_entries WHERE is_active = 'Y' AND entry_date BETWEEN $1 AND $2) AS external_entries,
       (SELECT COUNT(*)::int FROM tbl_stock_movements WHERE is_active = 'Y' AND movement_type = 'OUT' AND movement_date::date BETWEEN $1 AND $2) AS stock_outs`,
    [PERIOD.start, PERIOD.end]
  );
  const dirty = Object.entries(row).filter(([, v]) => v > 0);
  if (dirty.length > 0) {
    throw new Error(
      `Database already has data that affects ${PERIOD.name}: ` +
        dirty.map(([k, v]) => `${k}=${v}`).join(", ") +
        ". Clean it first (e.g. npm run db:setup) so the result can match the Excel."
    );
  }
};

const nextMemberNumber = async (client) => {
  const row = await one(
    client,
    `SELECT COALESCE(MAX(NULLIF(regexp_replace(member_code, '\\D', '', 'g'), '')::int), 0) AS max_no FROM tbl_members`
  );
  return row.max_no + 1;
};

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

const seed = async (client) => {
  const admin = await one(client, `SELECT id_user FROM tbl_users WHERE email = 'admin@cbsrevora.local'`);
  const cashier = await one(client, `SELECT id_user FROM tbl_users WHERE email = 'cashier@cbsrevora.local'`);
  const memberRole = await one(client, `SELECT id_role FROM tbl_roles WHERE UPPER(role_name) = 'MEMBER'`);
  if (!admin || !cashier || !memberRole) {
    throw new Error("Admin/cashier user or MEMBER role not found. Run npm run db:setup first.");
  }
  const adminId = admin.id_user;
  const cashierId = cashier.id_user;

  const supplier = await one(
    client,
    `INSERT INTO tbl_suppliers (supplier_code, supplier_name, city, phone_number, is_active, created_date, created_by)
     VALUES ($1, 'Supplier Koperasi 2025', 'Bandung', '0812-0000-2025', 'Y', '2024-11-25 08:00:00', $2)
     RETURNING id_supplier`,
    [SUPPLIER_CODE, adminId]
  );

  const stockIn = async ({ productId, productCode, date, purchaseCents, notes }) => {
    const ts = `${date} 08:00:00`;
    const code = await nextDailyCode(client, "tbl_stock_in_headers", "stock_in_code", "stock_in_date", date, (d, s) => `STI/${d}/${s}`);
    const header = await one(
      client,
      `INSERT INTO tbl_stock_in_headers (stock_in_code, id_supplier, stock_in_date, notes, created_date, created_by)
       VALUES ($1, $2, $3, $4, $3, $5) RETURNING id_stock_in`,
      [code, supplier.id_supplier, ts, `${MARK} ${notes}`, adminId]
    );
    const batch = await one(
      client,
      `INSERT INTO tbl_product_batches (id_product, batch_code, expired_date, purchase_price, created_date, created_by)
       VALUES ($1, $2, '2026-12-31', $3, $4, $5) RETURNING id_product_batch, batch_code`,
      [productId, `BATCH/${date.slice(2).replace(/-/g, "")}/${productCode}/001`, fromCents(purchaseCents), ts, adminId]
    );
    const item = await one(
      client,
      `INSERT INTO tbl_stock_in_items (id_stock_in, id_product, id_product_batch, quantity, expired_date, created_date, created_by)
       VALUES ($1, $2, $3, 1, '2026-12-31', $4, $5) RETURNING id_stock_in_item`,
      [header.id_stock_in, productId, batch.id_product_batch, ts, adminId]
    );
    await client.query(
      `INSERT INTO tbl_stock_movements (
         id_product, id_product_batch, movement_type, quantity, reason, notes,
         source_type, source_id, source_item_id, movement_date, created_date, created_by
       ) VALUES ($1, $2, 'IN', 1, 'STOCK_IN', $3, 'STOCK_IN', $4, $5, $6, $6, $7)`,
      [productId, batch.id_product_batch, `Stock in ${batch.batch_code}`, header.id_stock_in, item.id_stock_in_item, ts, adminId]
    );
    return batch.id_product_batch;
  };

  const product = async ({ code, name, priceCents, description }) =>
    one(
      client,
      `INSERT INTO tbl_products (product_code, product_name, description, id_supplier, selling_price, minimum_stock, is_active, created_date, created_by)
       VALUES ($1, $2, $3, $4, $5, 0, 'Y', '2024-11-25 08:00:00', $6) RETURNING id_product`,
      [code, name, description, supplier.id_supplier, fromCents(priceCents), adminId]
    );

  // Members, one product per member (price = Excel spending) and one sale each.
  let memberNo = await nextMemberNumber(client);
  for (let i = 0; i < MEMBERS.length; i += 1) {
    const m = MEMBERS[i];
    const [firstName, ...rest] = m.name.split(" ");
    const priceCents = toCents(m.spending);
    const saleDate = saleDateFor(m, i);

    const user = await one(
      client,
      `INSERT INTO tbl_users (email, password_hash, is_active, created_date, created_by)
       VALUES ($1, $2, 'Y', '2024-01-15 09:00:00', $3) RETURNING id_user`,
      [`${slug(m.name)}${EMAIL_SUFFIX}`, PASSWORD_HASH, adminId]
    );
    await client.query(
      `INSERT INTO tbl_user_roles (id_user, id_role, effective_start_date, is_active, created_date, created_by)
       VALUES ($1, $2, '2024-01-15', 'Y', '2024-01-15 09:00:00', $3)`,
      [user.id_user, memberRole.id_role, adminId]
    );
    await client.query(
      `INSERT INTO tbl_profiles (id_user, first_name, last_name, is_active, created_date, created_by)
       VALUES ($1, $2, $3, 'Y', '2024-01-15 09:00:00', $4)`,
      [user.id_user, firstName, rest.join(" ") || null, adminId]
    );
    const member = await one(
      client,
      `INSERT INTO tbl_members (id_user, member_code, join_date, total_spending, is_active, created_date, created_by, last_modify_date, last_modify_by)
       VALUES ($1, $2, '2024-01-15', $3, $4, '2024-01-15 09:00:00', $5, $6, $7) RETURNING id_member`,
      [
        user.id_user,
        `MBR-${String(memberNo).padStart(3, "0")}`,
        fromCents(priceCents),
        m.active ? "Y" : "N",
        adminId,
        m.active ? null : "2025-02-28 09:00:00",
        m.active ? null : adminId,
      ]
    );
    memberNo += 1;

    const code = `${CODE_PREFIX}${String(i + 1).padStart(3, "0")}`;
    const prod = await product({ code, name: m.name, priceCents, description: `${MARK} Produk belanja ${m.name} periode ${PERIOD.name}` });
    const batchId = await stockIn({
      productId: prod.id_product,
      productCode: code,
      date: saleDate,
      purchaseCents: priceCents - marginsCents[i],
      notes: `Stock in produk ${m.name}`,
    });

    const saleTs = `${saleDate} 10:00:00`;
    const saleNumber = await nextDailyCode(client, "tbl_sales", "sale_number", "sale_date", saleDate, (d, s) => `STO/${d}/S/${s}`);
    const sale = await one(
      client,
      `INSERT INTO tbl_sales (
         sale_number, id_member, id_cashier, customer_type, subtotal, discount_amount, total_amount,
         payment_method, amount_paid, change_amount, sale_date, notes, is_active, created_date, created_by
       ) VALUES ($1, $2, $3, 'MEMBER', $4, 0, $4, 'CASH', $4, 0, $5, $6, 'Y', $5, $3) RETURNING id_sale`,
      [saleNumber, member.id_member, cashierId, fromCents(priceCents), saleTs, `${MARK} Belanja ${m.name} periode ${PERIOD.name}`]
    );
    const saleItem = await one(
      client,
      `INSERT INTO tbl_sale_items (id_sale, id_product, id_product_batch, quantity, unit_price, subtotal, is_active, created_date, created_by)
       VALUES ($1, $2, $3, 1, $4, $4, 'Y', $5, $6) RETURNING id_sale_item`,
      [sale.id_sale, prod.id_product, batchId, fromCents(priceCents), saleTs, cashierId]
    );
    await client.query(
      `INSERT INTO tbl_stock_movements (
         id_product, id_product_batch, movement_type, quantity, reason, notes,
         source_type, source_id, source_item_id, movement_date, created_date, created_by
       ) VALUES ($1, $2, 'OUT', 1, 'SALE', $3, 'SALE', $4, $5, $6, $6, $7)`,
      [prod.id_product, batchId, `Sale ${saleNumber}`, sale.id_sale, saleItem.id_sale_item, saleTs, cashierId]
    );
  }

  // Rejected goods: bought in, then written off as a non-sale stock out (sales lane cost).
  const rejectCode = `${CODE_PREFIX}RJK`;
  const reject = await product({
    code: rejectCode,
    name: "Barang Rijek SO",
    priceCents: salesCostCents,
    description: `${MARK} Barang yang rijek saat stock opname`,
  });
  const rejectBatchId = await stockIn({
    productId: reject.id_product,
    productCode: rejectCode,
    date: "2025-05-05",
    purchaseCents: salesCostCents,
    notes: "Stock in barang yang kemudian rijek",
  });
  await client.query(
    `INSERT INTO tbl_stock_movements (
       id_product, id_product_batch, movement_type, quantity, reason, notes,
       source_type, source_id, movement_date, created_date, created_by
     ) VALUES ($1, $2, 'OUT', 1, 'NON_SALE_OUT:DAMAGED', 'Pengurangan SO Barang yg rijek', 'NON_SALE_OUT', gen_random_uuid(), $3, $3, $4)`,
    [reject.id_product, rejectBatchId, "2025-11-20 09:00:00", adminId]
  );

  // External Financial entries (business lane).
  const external = [
    ...BUSINESS_INCOMES.map((e) => ({ ...e, type: "INCOME" })),
    {
      type: "INCOME",
      date: "2024-12-20",
      source: "Kado Famgath",
      amount: kadoFamgathCents / 100,
      notes: "Keuntungan kado Famgath (bagian dari Keuntungan Penjualan Barang + Kado Famgath di Excel)",
    },
    ...BUSINESS_EXPENSES.map((e) => ({ ...e, type: "OUTCOME" })),
  ];
  for (const e of external) {
    await client.query(
      `INSERT INTO tbl_external_financial_entries (entry_type, entry_date, entry_source, amount, notes, is_active, created_date, created_by)
       VALUES ($1, $2, $3, $4, $5, 'Y', $6, $7)`,
      [e.type, e.date, e.source, fromCents(toCents(e.amount)), `${MARK} ${e.notes}`, `${e.date} 10:00:00`, adminId]
    );
  }

  // Register the period as DRAFT so it shows up on the SHU page (Calculate / Finalize).
  await client.query(
    `INSERT INTO tbl_shu_periods (period_name, start_date, end_date, calculation_status, notes, created_by)
     VALUES ($1, $2, $3, 'DRAFT', $4, $5)`,
    [PERIOD.name, PERIOD.start, PERIOD.end, `${MARK} Data uji sesuai Excel SHU 2025`, adminId]
  );
};

// ---------------------------------------------------------------------------
// Verification through the real backend calculation
// ---------------------------------------------------------------------------

const simulateWithBackend = async () => {
  const { getCurrentShuSimulation } = require("../../backend/modules/shu/shuController");
  let status = 200;
  let body = null;
  const res = {
    status(code) {
      status = code;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
  };
  await getCurrentShuSimulation({ query: { date: PERIOD.start } }, res);
  if (status !== 200) throw new Error(`Backend simulation failed: ${JSON.stringify(body)}`);
  return body.data;
};

const fmt = (n) =>
  Number(n).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const verify = (data) => {
  const TOLERANCE = 0.01; // NUMERIC(15,2) cannot hold Excel's repeating decimals exactly
  const checks = [];
  const check = (label, actual, expected) => {
    const ok = Math.abs(actual - expected) < TOLERANCE;
    checks.push({ Item: label, App: fmt(actual), Excel: fmt(expected), Status: ok ? "OK" : "MISMATCH" });
  };

  const s = data.snapshot;
  check("Total pendapatan (keuntungan)", s.sales_income_amount + s.business_income_amount, EXCEL.totalIncome);
  check("Total pengeluaran", s.sales_cost_amount + s.business_expense_amount, EXCEL.totalExpense);
  check("Laba bersih (dasar dana pengurus)", s.gross_profit_display, EXCEL.totalIncome - EXCEL.totalExpense);
  check("Pool SHU Usaha", s.business_shu_pool_amount, EXCEL.businessShuPool);
  check("Dana pengurus", s.total_manager_fund_amount, EXCEL.managerFund);
  check("Total SHU member", s.total_shu_distributed_amount, EXCEL.memberShuTotal);
  check("Jumlah member eligible SHU Usaha", data.meta.eligible_business_count, 19);
  check("Jumlah pengurus", data.meta.officer_count, 3);

  const byName = new Map(data.member_distributions.map((r) => [r.full_name, r]));
  const memberRows = MEMBERS.map((m) => {
    const row = byName.get(m.name);
    const expSales = m.spending * (m.active ? 0.2 : 0.05);
    const expBusiness = m.active ? EXCEL.businessShuPerMember : 0;
    const expTotal = expSales + expBusiness;
    const ok =
      row &&
      Math.abs(row.member_total_spending - m.spending) < TOLERANCE &&
      Math.abs(row.sales_shu_amount - expSales) < TOLERANCE &&
      Math.abs(row.business_shu_amount - expBusiness) < TOLERANCE &&
      Math.abs(row.shu_amount - expTotal) < TOLERANCE;
    return {
      Member: m.name + (m.active ? "" : " (N)"),
      Belanja: fmt(row ? row.member_total_spending : 0),
      "SHU Belanja": fmt(row ? row.sales_shu_amount : 0),
      "SHU Usaha": fmt(row ? row.business_shu_amount : 0),
      "Total App": fmt(row ? row.shu_amount : 0),
      "Total Excel": fmt(expTotal),
      Status: ok ? "OK" : "MISMATCH",
    };
  });
  if (data.member_distributions.length !== MEMBERS.length) {
    checks.push({ Item: "Jumlah member", App: data.member_distributions.length, Excel: MEMBERS.length, Status: "MISMATCH" });
  }

  const officerRows = data.officer_distributions.map((o) => {
    const ok = Math.abs(o.shu_amount - EXCEL.officerShare) < TOLERANCE;
    return { Jabatan: o.officer_role_code, App: fmt(o.shu_amount), Excel: fmt(EXCEL.officerShare), Status: ok ? "OK" : "MISMATCH" };
  });

  console.log("\nRingkasan periode");
  console.table(checks);
  console.log("\nSHU per member");
  console.table(memberRows);
  console.log("\nSHU pengurus");
  console.table(officerRows);

  const failed = [...checks, ...memberRows, ...officerRows].filter((r) => r.Status !== "OK").length;
  return failed;
};

// ---------------------------------------------------------------------------

const run = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const removed = await cleanup(client);
    if (removed.members || removed.products || removed.sales) {
      console.log(`Removed previous testSHU data: ${removed.members} members, ${removed.products} products, ${removed.sales} sales.`);
    }
    await assertPeriodIsClean(client);
    await seed(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`Seeded ${PERIOD.name} (${PERIOD.start} s.d. ${PERIOD.end}).`);
  console.log(
    [
      `  Laba kotor penjualan member : ${fmt(salesMarginCents / 100)} (harga jual ${fmt(totalSpendingCents / 100)})`,
      `  Stock out barang rijek      : ${fmt(salesCostCents / 100)}`,
      `  External income             : ${fmt((sumCents(BUSINESS_INCOMES) + kadoFamgathCents) / 100)} (termasuk Kado Famgath ${fmt(kadoFamgathCents / 100)})`,
      `  External outcome            : ${fmt(businessExpenseCents / 100)}`,
    ].join("\n")
  );

  const backendPool = require("../../backend/config/db");
  try {
    const data = await simulateWithBackend();
    const failed = verify(data);
    if (failed > 0) {
      console.error(`\n${failed} check(s) MISMATCH.`);
      process.exitCode = 1;
    } else {
      console.log("\nSemua hasil SHU sama dengan Excel. Buka halaman SHU, pilih SHU 2024-2025, lalu Calculate / Finalize.");
    }
  } finally {
    await backendPool.end();
  }
};

run().catch((error) => {
  console.error("testSHU failed:", error.message);
  process.exitCode = 1;
});

const { Pool } = require("pg");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function seedMissingSales() {
  const members = [
    { id: "f9294704-b5da-43ab-a9fb-5714a7f67b8f", code: "MBR-002", periods: ["CURRENT"] },
    { id: "ff883d77-3386-487f-9f57-0608e0e23981", code: "MBR-003", periods: ["LAST", "CURRENT"] },
    { id: "eff12e75-aa83-466a-9f58-3f89ca7f18dc", code: "MBR-004", periods: ["LAST", "CURRENT"] },
    { id: "caa2a8d1-3cfc-43e5-b045-96c56924c6c0", code: "MBR-005", periods: ["LAST", "CURRENT"] },
  ];

  const cashierId = "c6f1a22e-1f65-4355-be54-69ae3d326457";
  const productId = "0ca9e2c5-28fe-4568-bb32-5e64f3d81828"; // Ultra Milk
  const batchId = "794807a4-fb32-4c99-9e99-4a2ece3066f2";
  
  let i = 100;
  for (const m of members) {
    for (const p of m.periods) {
      i++;
      const saleId = `11112222-3333-4444-5555-${i.toString().padStart(12, '0')}`;
      const saleItemId = `99998888-7777-6666-5555-${i.toString().padStart(12, '0')}`;
      const date = p === "LAST" ? "2025-05-10 10:00:00" : "2026-03-10 10:00:00";
      const amount = 50000;
      const qty = 7;
      const unitPrice = 7000;
      const subtotal = 49000;

      await pool.query(`
        INSERT INTO tbl_sales (id_sale, sale_number, id_member, id_cashier, customer_type, subtotal, discount_amount, total_amount, payment_method, amount_paid, change_amount, sale_date, notes, is_active, created_date, created_by)
        VALUES ($1, $2, $3, $4, 'MEMBER', $5, 0, $5, 'CASH', $5, 0, $6, 'Auto seeded missing sale', 'Y', $6, $4)
      `, [saleId, `STO/AUTO/S/${i}`, m.id, cashierId, subtotal, date]);

      await pool.query(`
        INSERT INTO tbl_sale_items (id_sale_item, id_sale, id_product, id_product_batch, quantity, unit_price, subtotal, is_active, created_date, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'Y', $8, $9)
      `, [saleItemId, saleId, productId, batchId, qty, unitPrice, subtotal, date, cashierId]);

      // Update member total spending
      await pool.query(`UPDATE tbl_members SET total_spending = total_spending + $1 WHERE id_member = $2`, [subtotal, m.id]);
      
      console.log(`Seeded sale for ${m.code} in ${p} period`);
    }
  }
  
  await pool.end();
}

seedMissingSales().catch(console.error);

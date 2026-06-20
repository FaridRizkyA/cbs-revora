const pool = require("../../config/db");
const { getShuPeriodBounds } = require("../../utils/shuPeriodUtils");

const getMemberProfileByUserId = async (client, idUser) => {
  const result = await client.query(
    `
    SELECT
      m.id_member,
      m.id_user,
      p.id_profile,
      m.member_code,
      m.join_date,
      m.total_spending::float AS total_spending,
      m.is_active,
      m.created_date AS created_at,
      u.email,
      p.first_name,
      p.last_name,
      TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) AS full_name,
      p.phone_number,
      p.address,
      p.profile_image
    FROM tbl_members m
    LEFT JOIN tbl_users u
      ON u.id_user = m.id_user
    LEFT JOIN tbl_profiles p
      ON p.id_user = m.id_user
    WHERE m.id_user = $1
      AND m.is_active = 'Y'
    LIMIT 1;
    `,
    [idUser]
  );

  return result.rows[0] || null;
};

const getMemberAccess = async (req, res) => {
  const idUser = req.user?.id_user;
  if (!idUser) {
    return res.status(401).json({ message: "Access denied." });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        m.id_member,
        m.member_code,
        m.join_date,
        m.is_active,
        COALESCE(NULLIF(TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))), ''), u.email, '-') AS member_name
      FROM tbl_members m
      LEFT JOIN tbl_profiles p
        ON p.id_user = m.id_user
      LEFT JOIN tbl_users u
        ON u.id_user = m.id_user
      WHERE m.id_user = $1
        AND m.is_active = 'Y'
      LIMIT 1;
      `,
      [idUser]
    );

    return res.json({
      data: result.rows[0]
        ? {
            is_member: true,
            ...result.rows[0],
          }
        : {
            is_member: false,
            id_member: null,
            member_code: null,
            member_name: null,
            join_date: null,
            is_active: "N",
          },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load member access.", error: error.message });
  }
};

const getMemberByUserId = async (client, idUser) => {
  const result = await client.query(
    `
    SELECT
      m.id_member,
      m.id_user,
      m.member_code,
      m.join_date,
      m.total_spending::float AS total_spending,
      m.is_active,
      m.created_date AS created_at
    FROM tbl_members m
    WHERE m.id_user = $1
      AND m.is_active = 'Y'
    LIMIT 1;
    `,
    [idUser]
  );

  return result.rows[0] || null;
};

const parseRange = (query) => {
  const range = String(query.range || "ALL").trim().toUpperCase();
  if (query.start_date || query.end_date) {
    return {
      startDate: query.start_date || null,
      endDate: query.end_date || null,
    };
  }

  const now = new Date();
  // Get local ISO date (YYYY-MM-DD) by adjusting for timezone offset
  const getLocalIsoDate = (date) => {
    const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
    const localDate = new Date(date.getTime() - tzOffset);
    return localDate.toISOString().slice(0, 10);
  };

  const todayIso = getLocalIsoDate(now);

  if (range === "DAILY") {
    return { startDate: todayIso, endDate: todayIso };
  }

  if (range === "WEEKLY") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { startDate: getLocalIsoDate(start), endDate: todayIso };
  }

  if (range === "MONTHLY") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: getLocalIsoDate(start), endDate: todayIso };
  }

  return { startDate: null, endDate: null };
};

const getMemberOverview = async (req, res) => {
  const idUser = req.user?.id_user;
  if (!idUser) {
    return res.status(401).json({ message: "Access denied." });
  }

  const client = await pool.connect();
  try {
    const member = await getMemberProfileByUserId(client, idUser);
    if (!member) {
      return res.status(404).json({ message: "Member profile not found." });
    }

    const currentPeriod = getShuPeriodBounds();
    const [salesResult, recentSalesResult, currentShuPeriodResult, currentShuDistributionResult, monthlyTrendResult] = await Promise.all([
      client.query(
        `
        SELECT
          COALESCE(COUNT(*), 0)::int AS total_transactions,
          COALESCE(SUM(total_amount), 0)::float AS total_spending,
          COALESCE(MAX(sale_date), NOW()) AS last_transaction_date
        FROM tbl_sales
        WHERE is_active = 'Y'
          AND id_member = $1;
        `,
        [member.id_member]
      ),
      client.query(
        `
        SELECT
          s.id_sale,
          s.sale_number,
          s.sale_date,
          s.payment_method,
          s.total_amount::float AS total_amount,
          COALESCE(items.item_count, 0)::int AS item_count
        FROM tbl_sales s
        LEFT JOIN (
          SELECT id_sale, SUM(quantity)::int AS item_count
          FROM tbl_sale_items
          WHERE is_active = 'Y'
          GROUP BY id_sale
        ) items ON items.id_sale = s.id_sale
        WHERE s.is_active = 'Y'
          AND s.id_member = $1
        ORDER BY s.sale_date DESC, s.created_date DESC
        LIMIT 5;
        `,
        [member.id_member]
      ),
      client.query(
        `
        SELECT *
        FROM tbl_shu_periods
        WHERE period_name = $1
        LIMIT 1;
        `,
        [currentPeriod.period_name]
      ),
      client.query(
        `
        SELECT
          d.id_shu_distribution,
          d.id_member,
          d.sales_shu_amount::float AS sales_shu_amount,
          d.business_shu_amount::float AS business_shu_amount,
          d.shu_amount::float AS shu_amount,
          d.distribution_status,
          p.period_name
        FROM tbl_shu_distributions d
        JOIN tbl_shu_periods p
          ON p.id_shu_period = d.id_shu_period
        WHERE d.id_member = $1
          AND d.is_active = 'Y'
          AND p.period_name = $2
        LIMIT 1;
        `,
        [member.id_member, currentPeriod.period_name]
      ),
      client.query(
        `
        WITH months AS (
          SELECT date_trunc('month', NOW() - (m || ' month')::interval) as month
          FROM generate_series(0, 5) AS m
        )
        SELECT
          to_char(months.month, 'Mon YYYY') as month_label,
          COALESCE(SUM(s.total_amount), 0)::float as total_spending
        FROM months
        LEFT JOIN tbl_sales s
          ON date_trunc('month', s.sale_date) = months.month
          AND s.id_member = $1
          AND s.is_active = 'Y'
        GROUP BY months.month
        ORDER BY months.month ASC;
        `,
        [member.id_member]
      ),
    ]);

    const currentShuPeriod = currentShuPeriodResult.rows[0] || {
      id_shu_period: null,
      period_name: currentPeriod.period_name,
      start_date: currentPeriod.start_date,
      end_date: currentPeriod.end_date,
      calculation_status: "DRAFT",
    };

    return res.json({
      data: {
        member,
        metrics: {
          total_transactions: Number(salesResult.rows[0]?.total_transactions || 0),
          total_spending: Number(salesResult.rows[0]?.total_spending || 0),
          last_transaction_date: salesResult.rows[0]?.last_transaction_date || null,
          current_shu_amount: Number(currentShuDistributionResult.rows[0]?.shu_amount || 0),
          current_shu_status: currentShuDistributionResult.rows[0]?.distribution_status || currentShuPeriod.calculation_status || "DRAFT",
          current_shu_period: currentShuPeriod.period_name,
        },
        recent_transactions: recentSalesResult.rows,
        monthly_trend: monthlyTrendResult.rows,
        current_shu: currentShuDistributionResult.rows[0]
          ? {
              ...currentShuDistributionResult.rows[0],
              period: currentShuPeriod,
            }
          : null,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load member overview.", error: error.message });
  } finally {
    client.release();
  }
};

const listMemberTransactions = async (req, res) => {
  const idUser = req.user?.id_user;
  if (!idUser) return res.status(401).json({ message: "Access denied." });

  const { startDate, endDate } = parseRange(req.query);

  try {
    const member = await getMemberByUserId(pool, idUser);
    if (!member) {
      return res.status(404).json({ message: "Member profile not found." });
    }

    const result = await pool.query(
      `
      SELECT
        s.id_sale,
        s.sale_number,
        s.sale_date,
        s.payment_method,
        s.id_cashier,
        COALESCE(NULLIF(TRIM(CONCAT(COALESCE(up.first_name, ''), ' ', COALESCE(up.last_name, ''))), ''), u.email, '-') AS cashier_name,
        s.subtotal::float AS subtotal,
        s.discount_amount::float AS discount_amount,
        s.total_amount::float AS total_amount,
        s.amount_paid::float AS amount_paid,
        s.change_amount::float AS change_amount,
        s.notes,
        COALESCE(SUM(si.quantity), 0)::int AS item_count,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id_sale_item', si.id_sale_item,
              'id_product', si.id_product,
              'product_code', p.product_code,
              'product_name', p.product_name,
              'quantity', si.quantity,
              'unit_price', si.unit_price::float,
              'subtotal', si.subtotal::float
            )
            ORDER BY si.created_date ASC
          ) FILTER (WHERE si.id_sale_item IS NOT NULL),
          '[]'::json
        ) AS items
      FROM tbl_sales s
      LEFT JOIN tbl_sale_items si
        ON si.id_sale = s.id_sale
       AND si.is_active = 'Y'
      LEFT JOIN tbl_products p
        ON p.id_product = si.id_product
      LEFT JOIN tbl_users u
        ON u.id_user = s.id_cashier
      LEFT JOIN tbl_profiles up
        ON up.id_user = u.id_user
      WHERE s.is_active = 'Y'
        AND s.id_member = $1
        AND ($2::date IS NULL OR s.sale_date::date >= $2::date)
        AND ($3::date IS NULL OR s.sale_date::date <= $3::date)
      GROUP BY s.id_sale, s.id_cashier, u.email, up.first_name, up.last_name
      ORDER BY s.sale_date DESC, s.created_date DESC;
      `,
      [member.id_member, startDate, endDate]
    );

    return res.json({ data: result.rows });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load member transactions.", error: error.message });
  }
};

const getMemberTransactionDetail = async (req, res) => {
  const idUser = req.user?.id_user;
  if (!idUser) return res.status(401).json({ message: "Access denied." });

  try {
    const result = await pool.query(
      `
      SELECT
        s.id_sale,
        s.sale_number,
        s.sale_date,
        s.payment_method,
        s.id_cashier,
        COALESCE(NULLIF(TRIM(CONCAT(COALESCE(up.first_name, ''), ' ', COALESCE(up.last_name, ''))), ''), u.email, '-') AS cashier_name,
        s.subtotal::float AS subtotal,
        s.discount_amount::float AS discount_amount,
        s.total_amount::float AS total_amount,
        s.amount_paid::float AS amount_paid,
        s.change_amount::float AS change_amount,
        s.notes,
        m.member_code,
        TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) AS member_name,
        u.email AS member_email,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id_sale_item', si.id_sale_item,
              'id_product', si.id_product,
              'product_code', pr.product_code,
              'product_name', pr.product_name,
              'quantity', si.quantity,
              'unit_price', si.unit_price::float,
              'subtotal', si.subtotal::float
            )
            ORDER BY si.created_date ASC
          ) FILTER (WHERE si.id_sale_item IS NOT NULL),
          '[]'::json
        ) AS items
      FROM tbl_sales s
      JOIN tbl_members m ON m.id_member = s.id_member
      LEFT JOIN tbl_profiles p ON p.id_user = m.id_user
      LEFT JOIN tbl_users u ON u.id_user = m.id_user
      LEFT JOIN tbl_users cu ON cu.id_user = s.id_cashier
      LEFT JOIN tbl_profiles up ON up.id_user = cu.id_user
      LEFT JOIN tbl_sale_items si ON si.id_sale = s.id_sale AND si.is_active = 'Y'
      LEFT JOIN tbl_products pr ON pr.id_product = si.id_product
      WHERE s.id_sale = $1
        AND s.id_member = (
          SELECT id_member FROM tbl_members WHERE id_user = $2 AND is_active = 'Y' LIMIT 1
        )
      GROUP BY s.id_sale, s.id_cashier, m.member_code, p.first_name, p.last_name, u.email, cu.email, up.first_name, up.last_name;
      `,
      [req.params.idSale, idUser]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Transaction not found." });
    }

    return res.json({ data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load transaction detail.", error: error.message });
  }
};

const listMemberShuHistory = async (req, res) => {
  const idUser = req.user?.id_user;
  if (!idUser) return res.status(401).json({ message: "Access denied." });

  try {
    const memberResult = await pool.query(
      `SELECT id_member FROM tbl_members WHERE id_user = $1 AND is_active = 'Y' LIMIT 1;`,
      [idUser]
    );
    if (memberResult.rowCount === 0) {
      return res.status(404).json({ message: "Member profile not found." });
    }

    const result = await pool.query(
      `
      SELECT
        d.id_shu_distribution,
        d.id_shu_period,
        p.period_name,
        p.start_date,
        p.end_date,
        p.calculation_status,
        d.member_total_spending::float AS member_total_spending,
        d.spending_percentage::float AS spending_percentage,
        d.eligible_business_shu,
        d.sales_shu_amount::float AS sales_shu_amount,
        d.business_shu_amount::float AS business_shu_amount,
        d.shu_amount::float AS shu_amount,
        d.distribution_status
      FROM tbl_shu_distributions d
      JOIN tbl_shu_periods p
        ON p.id_shu_period = d.id_shu_period
      WHERE d.is_active = 'Y'
        AND d.id_member = $1
      ORDER BY p.start_date DESC, p.created_date DESC;
      `,
      [memberResult.rows[0].id_member]
    );

    return res.json({ data: result.rows });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load SHU history.", error: error.message });
  }
};

module.exports = {
  getMemberAccess,
  getMemberOverview,
  listMemberTransactions,
  getMemberTransactionDetail,
  listMemberShuHistory,
};

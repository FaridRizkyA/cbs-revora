const pool = require("../../config/db");
const { logActivity } = require("../../utils/activityLogger");
const { getShuPeriodBounds } = require("./shuPeriodUtils");

const OFFICER_ROLE_CODES = ["CHAIRPERSON", "VICE_CHAIRPERSON", "TREASURER"];
const OFFICER_ROLE_ORDER_SQL = `
  CASE od.officer_role_code
    WHEN 'CHAIRPERSON' THEN 1
    WHEN 'VICE_CHAIRPERSON' THEN 2
    WHEN 'TREASURER' THEN 3
    ELSE 99
  END
`;

const toDateOnly = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
};

const parsePositiveAmount = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
};

const isFinalizeAllowed = (periodEndDate, nowInput) => {
  const now = toDateOnly(nowInput) || toDateOnly();
  const end = toDateOnly(periodEndDate);
  if (!end) return false;
  return now.getTime() > end.getTime();
};

const isShuFinalizer = async (client, idUser) => {
  if (!idUser) return false;

  const result = await client.query(
    `
    SELECT
      EXISTS (
        SELECT 1
        FROM tbl_user_roles ur
        JOIN tbl_roles r
          ON r.id_role = ur.id_role
        WHERE ur.id_user = $1
          AND ur.is_active = 'Y'
          AND r.is_active = 'Y'
          AND UPPER(TRIM(r.role_name)) = 'ADMIN'
          AND ur.effective_start_date <= CURRENT_DATE
          AND (ur.effective_end_date IS NULL OR ur.effective_end_date >= CURRENT_DATE)
      ) AS is_admin,
      EXISTS (
        SELECT 1
        FROM tbl_staff s
        JOIN tbl_staff_grades g
          ON g.id_staff_grade = s.id_staff_grade
        WHERE s.id_user = $1
          AND s.is_active = 'Y'
          AND g.is_active = 'Y'
          AND UPPER(TRIM(g.grade_name)) LIKE '%TREASURER%'
      ) AS is_treasurer_grade,
      EXISTS (
        SELECT 1
        FROM tbl_staff s
        JOIN tbl_staff_officer_roles sor
          ON sor.id_staff = s.id_staff
        WHERE s.id_user = $1
          AND s.is_active = 'Y'
          AND sor.is_active = 'Y'
          AND UPPER(TRIM(sor.officer_role_code)) = 'TREASURER'
          AND sor.effective_start_date <= CURRENT_DATE
          AND (sor.effective_end_date IS NULL OR sor.effective_end_date >= CURRENT_DATE)
      ) AS is_treasurer_officer;
    `,
    [idUser]
  );

  const row = result.rows[0] || {};
  return Boolean(row.is_admin || row.is_treasurer_grade || row.is_treasurer_officer);
};

const ensurePeriod = async (client, period) => {
  const existing = await client.query(
    `
    SELECT id_shu_period, period_name, start_date, end_date, calculation_status
    FROM tbl_shu_periods
    WHERE period_name = $1
    LIMIT 1;
    `,
    [period.period_name]
  );
  if (existing.rowCount > 0) return existing.rows[0];

  const inserted = await client.query(
    `
    INSERT INTO tbl_shu_periods (
      period_name, start_date, end_date, calculation_status
    ) VALUES ($1, $2, $3, 'DRAFT')
    RETURNING id_shu_period, period_name, start_date, end_date, calculation_status;
    `,
    [period.period_name, period.start_date, period.end_date]
  );
  return inserted.rows[0];
};

const calculateShuData = async (client, period) => {
  const { start_date, end_date } = period;

  const [salesProfitResult, extResult, taggedPathResult, memberSpendResult, expenseResult, officersResult] = await Promise.all([
    client.query(
      `
      SELECT
        COALESCE(
          SUM(
            (COALESCE(si.unit_price, 0) - COALESCE(pb.purchase_price, 0)) * si.quantity
          ),
          0
        )::float AS amount
      FROM tbl_sale_items si
      JOIN tbl_sales s
        ON s.id_sale = si.id_sale
       AND s.is_active = 'Y'
      LEFT JOIN tbl_product_batches pb
        ON pb.id_product_batch = si.id_product_batch
      WHERE si.is_active = 'Y'
        AND s.sale_date::date BETWEEN $1::date AND $2::date;
      `,
      [start_date, end_date]
    ),
    client.query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN entry_type = 'INCOME' THEN amount ELSE 0 END), 0)::float AS income_usaha_amount,
        COALESCE(SUM(CASE WHEN entry_type = 'OUTCOME' THEN amount ELSE 0 END), 0)::float AS expense_usaha_amount
      FROM tbl_external_financial_entries
      WHERE is_active = 'Y'
        AND entry_date BETWEEN $1::date AND $2::date;
      `,
      [start_date, end_date]
    ),
    client.query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN entry_type = 'INCOME'  AND entry_source ILIKE 'BELANJA:%' THEN amount ELSE 0 END), 0)::float AS income_belanja_amount,
        COALESCE(SUM(CASE WHEN entry_type = 'OUTCOME' AND entry_source ILIKE 'BELANJA:%' THEN amount ELSE 0 END), 0)::float AS expense_belanja_amount,
        COALESCE(SUM(CASE WHEN entry_type = 'INCOME'  AND entry_source ILIKE 'USAHA:%' THEN amount ELSE 0 END), 0)::float AS income_usaha_amount,
        COALESCE(SUM(CASE WHEN entry_type = 'OUTCOME' AND entry_source ILIKE 'USAHA:%' THEN amount ELSE 0 END), 0)::float AS expense_usaha_amount,
        COUNT(*) FILTER (
          WHERE entry_source ILIKE 'BELANJA:%' OR entry_source ILIKE 'USAHA:%'
        )::int AS tagged_rows
      FROM tbl_external_financial_entries
      WHERE is_active = 'Y'
        AND entry_date BETWEEN $1::date AND $2::date;
      `,
      [start_date, end_date]
    ),
    client.query(
      `
      SELECT
        m.id_member,
        TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) AS full_name,
        m.is_active,
        COALESCE(SUM(s.total_amount), 0)::float AS member_total_spending
      FROM tbl_members m
      LEFT JOIN tbl_profiles p
        ON p.id_profile = m.id_profile
      LEFT JOIN tbl_sales s
        ON s.id_member = m.id_member
       AND s.is_active = 'Y'
       AND s.sale_date::date BETWEEN $1::date AND $2::date
      GROUP BY m.id_member, p.first_name, p.last_name, m.is_active
      ORDER BY TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) ASC;
      `,
      [start_date, end_date]
    ),
    client.query(
      `
      WITH movement_loss AS (
        SELECT
          sm.id_stock_movement,
          CASE
            WHEN sm.movement_type = 'OUT'
             AND sm.source_type = 'NON_SALE_OUT'
             AND sm.reason NOT IN (
               'NON_SALE_OUT:RETURN_TO_SUPPLIER_REFUND'
             )
              THEN (COALESCE(pb.purchase_price, 0) * sm.quantity)
            WHEN sm.movement_type = 'OUT'
             AND sm.reason LIKE 'ADJUSTMENT_DECREASE:%'
              THEN (COALESCE(pb.purchase_price, 0) * sm.quantity)
            ELSE 0
          END AS expense_amount
        FROM tbl_stock_movements sm
        LEFT JOIN tbl_product_batches pb
          ON pb.id_product_batch = sm.id_product_batch
        WHERE sm.is_active = 'Y'
          AND sm.movement_date::date BETWEEN $1::date AND $2::date
      )
      SELECT COALESCE(SUM(expense_amount), 0)::float AS expense_belanja_amount
      FROM movement_loss;
      `,
      [start_date, end_date]
    ),
    client.query(
      `
      SELECT
        s.id_staff,
        sor.officer_role_code
      FROM tbl_staff_officer_roles sor
      JOIN tbl_staff s
        ON s.id_staff = sor.id_staff
      WHERE sor.is_active = 'Y'
        AND sor.is_shu_eligible = 'Y'
        AND s.is_active = 'Y'
        AND sor.officer_role_code = ANY($1::text[])
        AND sor.effective_start_date <= $3::date
        AND (sor.effective_end_date IS NULL OR sor.effective_end_date >= $2::date)
      ORDER BY
        CASE sor.officer_role_code
          WHEN 'CHAIRPERSON' THEN 1
          WHEN 'VICE_CHAIRPERSON' THEN 2
          WHEN 'TREASURER' THEN 3
          ELSE 99
        END ASC,
        sor.created_date ASC;
      `,
      [OFFICER_ROLE_CODES, start_date, end_date]
    ),
  ]);

  const tagged = taggedPathResult.rows[0] || {};
  const useTaggedSheet2Path = Number(tagged.tagged_rows || 0) > 0;

  const incomeBelanja = useTaggedSheet2Path
    ? parsePositiveAmount(tagged.income_belanja_amount)
    : parsePositiveAmount(salesProfitResult.rows[0]?.amount);
  const expenseBelanja = useTaggedSheet2Path
    ? parsePositiveAmount(tagged.expense_belanja_amount)
    : parsePositiveAmount(expenseResult.rows[0]?.expense_belanja_amount);

  const incomeUsaha = useTaggedSheet2Path
    ? parsePositiveAmount(tagged.income_usaha_amount)
    : parsePositiveAmount(extResult.rows[0]?.income_usaha_amount);
  const expenseUsaha = useTaggedSheet2Path
    ? parsePositiveAmount(tagged.expense_usaha_amount)
    : parsePositiveAmount(extResult.rows[0]?.expense_usaha_amount);

  const netBelanja = Math.max(0, incomeBelanja - expenseBelanja);
  const netUsaha = Math.max(0, incomeUsaha - expenseUsaha);

  const managerCutBelanja = netBelanja * 0.1;
  const managerCutUsaha = netUsaha * 0.1;

  const shuBelanjaPool = Math.max(0, netBelanja - managerCutBelanja);
  const shuUsahaPool = Math.max(0, netUsaha - managerCutUsaha);

  const grossProfitDisplay = Math.max(0, incomeBelanja + incomeUsaha - expenseBelanja - expenseUsaha);
  const totalManagerFund = managerCutBelanja + managerCutUsaha;

  const memberRows = memberSpendResult.rows.map((row) => ({
    id_member: row.id_member,
    full_name: row.full_name,
    is_active: row.is_active,
    member_total_spending: parsePositiveAmount(row.member_total_spending),
  }));

  const totalMemberSpending = memberRows.reduce((sum, row) => sum + row.member_total_spending, 0);
  const eligibleUsahaRows = memberRows.filter((row) => row.is_active === "Y");
  const eligibleUsahaCount = eligibleUsahaRows.length;
  const shuUsahaPerEligible = eligibleUsahaCount > 0 ? shuUsahaPool / eligibleUsahaCount : 0;

  const memberDistributions = memberRows.map((row) => {
    const percentage = totalMemberSpending > 0 ? row.member_total_spending / totalMemberSpending : 0;
    const shuBelanjaAmount = percentage * shuBelanjaPool;
    const eligible = row.is_active === "Y";
    const shuUsahaAmount = eligible ? shuUsahaPerEligible : 0;
    const shuAmount = shuBelanjaAmount + shuUsahaAmount;
    return {
      ...row,
      eligible_shu_usaha: eligible,
      spending_percentage: percentage,
      shu_belanja_amount: shuBelanjaAmount,
      shu_usaha_amount: shuUsahaAmount,
      shu_amount: shuAmount,
    };
  });

  const totalShuDistributed = memberDistributions.reduce((sum, row) => sum + row.shu_amount, 0);
  const reconciliationGap = grossProfitDisplay - (totalShuDistributed + totalManagerFund);

  const officerRows = officersResult.rows;
  const officerCount = officerRows.length;
  const perOfficerAmount = officerCount > 0 ? totalManagerFund / officerCount : 0;
  const officerDistributions = officerRows.map((row) => ({
    id_staff: row.id_staff,
    officer_role_code: row.officer_role_code,
    shu_amount: perOfficerAmount,
  }));

  return {
    snapshot: {
      total_cooperative_income: incomeBelanja + incomeUsaha,
      total_member_spending: totalMemberSpending,
      gross_profit_display: grossProfitDisplay,
      income_belanja_amount: incomeBelanja,
      expense_belanja_amount: expenseBelanja,
      net_belanja_amount: netBelanja,
      manager_cut_belanja_amount: managerCutBelanja,
      shu_belanja_pool_amount: shuBelanjaPool,
      income_usaha_amount: incomeUsaha,
      expense_usaha_amount: expenseUsaha,
      net_usaha_amount: netUsaha,
      manager_cut_usaha_amount: managerCutUsaha,
      shu_usaha_pool_amount: shuUsahaPool,
      total_shu_distributed_amount: totalShuDistributed,
      total_manager_fund_amount: totalManagerFund,
      reconciliation_gap_amount: reconciliationGap,
    },
    member_distributions: memberDistributions,
    officer_distributions: officerDistributions,
    meta: {
      eligible_usaha_count: eligibleUsahaCount,
      officer_count: officerCount,
    },
  };
};

const persistShuResult = async (client, periodId, data, status, idUser) => {
  const s = data.snapshot;
  await client.query(
    `
    UPDATE tbl_shu_periods
    SET
      total_cooperative_income = $2,
      total_member_spending = $3,
      gross_profit_display = $4,
      income_belanja_amount = $5,
      expense_belanja_amount = $6,
      net_belanja_amount = $7,
      manager_cut_belanja_amount = $8,
      shu_belanja_pool_amount = $9,
      income_usaha_amount = $10,
      expense_usaha_amount = $11,
      net_usaha_amount = $12,
      manager_cut_usaha_amount = $13,
      shu_usaha_pool_amount = $14,
      total_shu_distributed_amount = $15,
      total_manager_fund_amount = $16,
      reconciliation_gap_amount = $17,
      calculation_status = $18,
      last_modify_date = NOW(),
      last_modify_by = $19
    WHERE id_shu_period = $1;
    `,
    [
      periodId,
      s.total_cooperative_income,
      s.total_member_spending,
      s.gross_profit_display,
      s.income_belanja_amount,
      s.expense_belanja_amount,
      s.net_belanja_amount,
      s.manager_cut_belanja_amount,
      s.shu_belanja_pool_amount,
      s.income_usaha_amount,
      s.expense_usaha_amount,
      s.net_usaha_amount,
      s.manager_cut_usaha_amount,
      s.shu_usaha_pool_amount,
      s.total_shu_distributed_amount,
      s.total_manager_fund_amount,
      s.reconciliation_gap_amount,
      status,
      idUser || null,
    ]
  );

  for (const row of data.member_distributions) {
    await client.query(
      `
      INSERT INTO tbl_shu_distributions (
        id_shu_period, id_member, member_total_spending, spending_percentage,
        eligible_shu_usaha, shu_belanja_amount, shu_usaha_amount, shu_amount,
        distribution_status, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      )
      ON CONFLICT (id_shu_period, id_member) DO UPDATE SET
        member_total_spending = EXCLUDED.member_total_spending,
        spending_percentage = EXCLUDED.spending_percentage,
        eligible_shu_usaha = EXCLUDED.eligible_shu_usaha,
        shu_belanja_amount = EXCLUDED.shu_belanja_amount,
        shu_usaha_amount = EXCLUDED.shu_usaha_amount,
        shu_amount = EXCLUDED.shu_amount,
        distribution_status = EXCLUDED.distribution_status,
        last_modify_date = NOW(),
        last_modify_by = EXCLUDED.created_by;
      `,
      [
        periodId,
        row.id_member,
        row.member_total_spending,
        row.spending_percentage,
        row.eligible_shu_usaha,
        row.shu_belanja_amount,
        row.shu_usaha_amount,
        row.shu_amount,
        status === "FINALIZED" ? "DISTRIBUTED" : "CALCULATED",
        idUser || null,
      ]
    );
  }

  for (const officer of data.officer_distributions) {
    await client.query(
      `
      INSERT INTO tbl_shu_officer_distributions (
        id_shu_period, id_staff, officer_role_code, shu_amount,
        distribution_status, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6
      )
      ON CONFLICT (id_shu_period, id_staff) WHERE is_active = 'Y'
      DO UPDATE SET
        officer_role_code = EXCLUDED.officer_role_code,
        shu_amount = EXCLUDED.shu_amount,
        distribution_status = EXCLUDED.distribution_status,
        last_modify_date = NOW(),
        last_modify_by = EXCLUDED.created_by;
      `,
      [
        periodId,
        officer.id_staff,
        officer.officer_role_code,
        officer.shu_amount,
        status === "FINALIZED" ? "DISTRIBUTED" : "CALCULATED",
        idUser || null,
      ]
    );
  }
};

const getPeriodDetailTables = async (client, startDate, endDate) => {
  const [monthlyIncomeRows, yearlyExpenseRows] = await Promise.all([
    client.query(
      `
      WITH month_key AS (
        SELECT to_char(gs::date, 'YYYY-MM') AS month
        FROM generate_series($1::date, $2::date, interval '1 month') gs
      ),
      sales AS (
        SELECT
          to_char(s.sale_date::date, 'YYYY-MM') AS month,
          COALESCE(SUM(s.total_amount), 0)::float AS sales_turnover_amount
        FROM tbl_sales s
        WHERE s.is_active = 'Y'
          AND s.sale_date::date BETWEEN $1::date AND $2::date
        GROUP BY 1
      ),
      ext_inc AS (
        SELECT
          to_char(e.entry_date::date, 'YYYY-MM') AS month,
          COALESCE(SUM(e.amount), 0)::float AS external_income_amount
        FROM tbl_external_financial_entries e
        WHERE e.is_active = 'Y'
          AND e.entry_type = 'INCOME'
          AND e.entry_date::date BETWEEN $1::date AND $2::date
        GROUP BY 1
      )
      SELECT
        mk.month,
        COALESCE(s.sales_turnover_amount, 0)::float AS sales_turnover_amount,
        COALESCE(e.external_income_amount, 0)::float AS external_income_amount,
        (COALESCE(s.sales_turnover_amount, 0) + COALESCE(e.external_income_amount, 0))::float AS total_income_amount
      FROM month_key mk
      LEFT JOIN sales s ON s.month = mk.month
      LEFT JOIN ext_inc e ON e.month = mk.month
      ORDER BY mk.month ASC;
      `,
      [startDate, endDate]
    ),
    client.query(
      `
      SELECT
        x.expense_date,
        x.expense_type,
        x.source,
        x.notes,
        x.amount::float AS amount
      FROM (
        SELECT
          e.entry_date::date AS expense_date,
          'EXTERNAL_OUTCOME'::text AS expense_type,
          COALESCE(e.entry_source, 'EXTERNAL') AS source,
          COALESCE(e.notes, '') AS notes,
          e.amount
        FROM tbl_external_financial_entries e
        WHERE e.is_active = 'Y'
          AND e.entry_type = 'OUTCOME'
          AND e.entry_date::date BETWEEN $1::date AND $2::date

        UNION ALL

        SELECT
          h.stock_in_date::date AS expense_date,
          'STOCK_IN_PURCHASE'::text AS expense_type,
          COALESCE(h.stock_in_code, 'STOCK_IN') AS source,
          COALESCE(h.notes, '') AS notes,
          COALESCE(SUM(i.quantity * COALESCE(pb.purchase_price, 0)), 0)::numeric AS amount
        FROM tbl_stock_in_headers h
        JOIN tbl_stock_in_items i
          ON i.id_stock_in = h.id_stock_in
        LEFT JOIN tbl_product_batches pb
          ON pb.id_product_batch = i.id_product_batch
        WHERE h.stock_in_date::date BETWEEN $1::date AND $2::date
        GROUP BY h.stock_in_date::date, h.stock_in_code, h.notes
      ) x
      ORDER BY x.expense_date ASC, x.expense_type ASC, x.source ASC;
      `,
      [startDate, endDate]
    ),
  ]);

  return {
    monthly_income: monthlyIncomeRows.rows,
    yearly_expenses: yearlyExpenseRows.rows,
  };
};

const getCurrentShuSimulation = async (req, res) => {
  const period = getShuPeriodBounds(req.query.date);
  const client = await pool.connect();
  try {
    const data = await calculateShuData(client, period);
    return res.json({
      data: {
        period,
        mode: "SIMULATION",
        ...data,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to simulate SHU.", error: error.message });
  } finally {
    client.release();
  }
};

const calculateCurrentShu = async (req, res) => {
  const period = getShuPeriodBounds(req.body?.date || req.query?.date);
  const idUser = req.body?.id_user || null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const periodRow = await ensurePeriod(client, period);
    if (periodRow.calculation_status === "FINALIZED") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "SHU sudah finalized dan tidak dapat dihitung ulang.",
      });
    }

    const data = await calculateShuData(client, period);
    await persistShuResult(client, periodRow.id_shu_period, data, "CALCULATED", idUser);
    await logActivity(client, req, {
      idUser,
      activityType: "CALCULATE_SHU",
      tableName: "tbl_shu_periods",
      recordId: periodRow.id_shu_period,
      description: `Calculated SHU period ${period.period_name}.`,
    });
    await client.query("COMMIT");
    return res.json({
      message: "SHU calculated successfully.",
      data: {
        period: { ...periodRow, calculation_status: "CALCULATED" },
        mode: "CALCULATED",
        ...data,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(500).json({ message: "Failed to calculate SHU.", error: error.message });
  } finally {
    client.release();
  }
};

const finalizeCurrentShu = async (req, res) => {
  const period = getShuPeriodBounds(req.body?.date || req.query?.date);
  const idUser = req.body?.id_user || null;
  const client = await pool.connect();
  try {
    if (!isFinalizeAllowed(period.end_date, req.body?.now || req.query?.now)) {
      return res.status(400).json({
        message: "Finalisasi SHU hanya boleh setelah periode berakhir.",
        detail: {
          period_end_date: period.end_date,
          finalize_allowed: false,
        },
      });
    }

    await client.query("BEGIN");
    const canFinalize = await isShuFinalizer(client, idUser);
    if (!canFinalize) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: "SHU finalization can only be performed by an Admin or Treasurer.",
      });
    }

    const periodRow = await ensurePeriod(client, period);
    if (periodRow.calculation_status === "FINALIZED") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "SHU sudah finalized.",
      });
    }

    const data = await calculateShuData(client, period);
    await persistShuResult(client, periodRow.id_shu_period, data, "FINALIZED", idUser);

    await client.query(
      `
      UPDATE tbl_shu_distributions
      SET distribution_status = 'DISTRIBUTED',
          distributed_date = NOW(),
          last_modify_date = NOW(),
          last_modify_by = $2
      WHERE id_shu_period = $1;
      `,
      [periodRow.id_shu_period, idUser]
    );

    await client.query(
      `
      UPDATE tbl_shu_officer_distributions
      SET distribution_status = 'DISTRIBUTED',
          distributed_date = NOW(),
          last_modify_date = NOW(),
          last_modify_by = $2
      WHERE id_shu_period = $1
        AND is_active = 'Y';
      `,
      [periodRow.id_shu_period, idUser]
    );

    await logActivity(client, req, {
      idUser,
      activityType: "FINALIZE_SHU",
      tableName: "tbl_shu_periods",
      recordId: periodRow.id_shu_period,
      description: `Finalized SHU period ${period.period_name}.`,
    });

    await client.query("COMMIT");
    return res.json({
      message: "SHU finalized successfully.",
      data: {
        period: { ...periodRow, calculation_status: "FINALIZED" },
        mode: "FINALIZED",
        ...data,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(500).json({ message: "Failed to finalize SHU.", error: error.message });
  } finally {
    client.release();
  }
};

const getCurrentShuResult = async (req, res) => {
  const period = getShuPeriodBounds(req.query.date);
  try {
    const periodResult = await pool.query(
      `
      SELECT *
      FROM tbl_shu_periods
      WHERE period_name = $1
      LIMIT 1;
      `,
      [period.period_name]
    );

    if (periodResult.rowCount === 0) {
      return res.status(404).json({ message: "SHU period not calculated yet." });
    }

    const periodRow = periodResult.rows[0];
    const [memberRows, officerRows] = await Promise.all([
      pool.query(
        `
        SELECT
          d.id_shu_distribution,
          d.id_member,
          m.member_code,
          m.is_active,
          TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) AS full_name,
          d.member_total_spending::float AS member_total_spending,
          d.spending_percentage::float AS spending_percentage,
          d.eligible_shu_usaha,
          d.shu_belanja_amount::float AS shu_belanja_amount,
          d.shu_usaha_amount::float AS shu_usaha_amount,
          d.shu_amount::float AS shu_amount,
          d.distribution_status
        FROM tbl_shu_distributions d
        JOIN tbl_members m
          ON m.id_member = d.id_member
        LEFT JOIN tbl_profiles p
          ON p.id_profile = m.id_profile
        WHERE d.id_shu_period = $1
          AND d.is_active = 'Y'
          AND m.is_active = 'Y'
        ORDER BY TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) ASC;
        `,
        [periodRow.id_shu_period]
      ),
      pool.query(
        `
        SELECT
          od.id_shu_officer_distribution,
          od.id_staff,
          od.officer_role_code,
          od.shu_amount::float AS shu_amount,
          od.distribution_status
        FROM tbl_shu_officer_distributions od
        WHERE od.id_shu_period = $1
          AND od.is_active = 'Y'
        ORDER BY ${OFFICER_ROLE_ORDER_SQL} ASC, od.created_date ASC;
        `,
        [periodRow.id_shu_period]
      ),
    ]);

    return res.json({
      data: {
        period: periodRow,
        member_distributions: memberRows.rows,
        officer_distributions: officerRows.rows,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch SHU result.", error: error.message });
  }
};

const getCurrentShuDetail = async (req, res) => {
  const requestedPeriodId = req.query.id_shu_period || null;
  const period = getShuPeriodBounds(req.query.date);
  try {
    const periodResult = requestedPeriodId
      ? await pool.query(
          `
          SELECT *
          FROM tbl_shu_periods
          WHERE id_shu_period = $1
          LIMIT 1;
          `,
          [requestedPeriodId]
        )
      : await pool.query(
          `
          SELECT *
          FROM tbl_shu_periods
          WHERE period_name = $1
          LIMIT 1;
          `,
          [period.period_name]
        );

    if (periodResult.rowCount === 0) {
      const client = await pool.connect();
      try {
        const liveData = await calculateShuData(client, period);
        const detailTables = await getPeriodDetailTables(client, period.start_date, period.end_date);
        return res.json({
          data: {
            period: {
              id_shu_period: null,
              period_name: period.period_name,
              start_date: period.start_date,
              end_date: period.end_date,
              calculation_status: "ONGOING",
              ...liveData.snapshot,
            },
            finalize_policy: {
              finalize_allowed: isFinalizeAllowed(period.end_date, req.query?.now),
              period_end_date: period.end_date,
            },
            monthly_income: detailTables.monthly_income,
            yearly_expenses: detailTables.yearly_expenses,
            member_distributions: liveData.member_distributions,
            officer_distributions: liveData.officer_distributions,
            remaining_shu: {
              gross_profit_amount: Number(liveData.snapshot.gross_profit_display || 0),
              member_distributed_amount: Number(liveData.snapshot.total_shu_distributed_amount || 0),
              officer_distributed_amount: Number(liveData.snapshot.total_manager_fund_amount || 0),
              remaining_shu_amount: Number(liveData.snapshot.reconciliation_gap_amount || 0),
            },
          },
        });
      } finally {
        client.release();
      }
    }

    const periodRow = periodResult.rows[0];
    const currentPeriod = getShuPeriodBounds();
    const shouldUseLiveData =
      periodRow.period_name === currentPeriod.period_name && periodRow.calculation_status !== "FINALIZED";

    if (shouldUseLiveData) {
      const client = await pool.connect();
      try {
        const liveData = await calculateShuData(client, {
          period_name: periodRow.period_name,
          start_date: periodRow.start_date,
          end_date: periodRow.end_date,
        });
        const detailTables = await getPeriodDetailTables(client, periodRow.start_date, periodRow.end_date);
        return res.json({
          data: {
            period: {
              ...periodRow,
              calculation_status: "ONGOING",
              ...liveData.snapshot,
            },
            finalize_policy: {
              finalize_allowed: isFinalizeAllowed(periodRow.end_date, req.query?.now),
              period_end_date: periodRow.end_date,
            },
            monthly_income: detailTables.monthly_income,
            yearly_expenses: detailTables.yearly_expenses,
            member_distributions: liveData.member_distributions,
            officer_distributions: liveData.officer_distributions,
            remaining_shu: {
              gross_profit_amount: Number(liveData.snapshot.gross_profit_display || 0),
              member_distributed_amount: Number(liveData.snapshot.total_shu_distributed_amount || 0),
              officer_distributed_amount: Number(liveData.snapshot.total_manager_fund_amount || 0),
              remaining_shu_amount: Number(liveData.snapshot.reconciliation_gap_amount || 0),
            },
          },
        });
      } finally {
        client.release();
      }
    }

    const [memberRows, officerRows, detailTables] = await Promise.all([
      pool.query(
        `
        SELECT
          d.id_shu_distribution,
          d.id_member,
          m.member_code,
          m.is_active,
          TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) AS full_name,
          d.member_total_spending::float AS member_total_spending,
          d.spending_percentage::float AS spending_percentage,
          d.eligible_shu_usaha,
          d.shu_belanja_amount::float AS shu_belanja_amount,
          d.shu_usaha_amount::float AS shu_usaha_amount,
          d.shu_amount::float AS shu_amount,
          d.distribution_status
        FROM tbl_shu_distributions d
        JOIN tbl_members m
          ON m.id_member = d.id_member
        LEFT JOIN tbl_profiles p
          ON p.id_profile = m.id_profile
        WHERE d.id_shu_period = $1
          AND d.is_active = 'Y'
          AND m.is_active = 'Y'
        ORDER BY TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) ASC;
        `,
        [periodRow.id_shu_period]
      ),
      pool.query(
        `
        SELECT
          od.id_shu_officer_distribution,
          od.id_staff,
          od.officer_role_code,
          od.shu_amount::float AS shu_amount,
          od.distribution_status
        FROM tbl_shu_officer_distributions od
        WHERE od.id_shu_period = $1
          AND od.is_active = 'Y'
        ORDER BY ${OFFICER_ROLE_ORDER_SQL} ASC, od.created_date ASC;
        `,
        [periodRow.id_shu_period]
      ),
      getPeriodDetailTables(pool, periodRow.start_date, periodRow.end_date),
    ]);

    const memberTotal = memberRows.rows.reduce((sum, row) => sum + Number(row.shu_amount || 0), 0);
    const officerTotal = officerRows.rows.reduce((sum, row) => sum + Number(row.shu_amount || 0), 0);
    const grossProfit = Number(periodRow.gross_profit_display || 0);
    const remainingShu = grossProfit - (memberTotal + officerTotal);

    return res.json({
      data: {
        period: periodRow,
        finalize_policy: {
          finalize_allowed: isFinalizeAllowed(periodRow.end_date, req.query?.now),
          period_end_date: periodRow.end_date,
        },
        monthly_income: detailTables.monthly_income,
        yearly_expenses: detailTables.yearly_expenses,
        member_distributions: memberRows.rows,
        officer_distributions: officerRows.rows,
        remaining_shu: {
          gross_profit_amount: grossProfit,
          member_distributed_amount: memberTotal,
          officer_distributed_amount: officerTotal,
          remaining_shu_amount: remainingShu,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch SHU detail.", error: error.message });
  }
};

const getShuYearlySummary = async (_req, res) => {
  try {
    const currentPeriod = getShuPeriodBounds();
    const client = await pool.connect();
    let liveSnapshot = null;
    try {
      const liveData = await calculateShuData(client, currentPeriod);
      liveSnapshot = liveData.snapshot;
    } finally {
      client.release();
    }

    const rowsResult = await pool.query(
      `
      SELECT
        p.id_shu_period,
        p.period_name,
        p.start_date,
        p.end_date,
        p.calculation_status,
        COALESCE(p.total_shu_distributed_amount, 0)::float AS total_shu_distributed_amount,
        COALESCE(p.total_manager_fund_amount, 0)::float AS total_manager_fund_amount,
        COALESCE(p.gross_profit_display, 0)::float AS gross_profit_display
      FROM tbl_shu_periods p
      WHERE p.is_active = 'Y'
      ORDER BY p.start_date DESC;
      `
    );

    const mapped = rowsResult.rows.map((row) => {
      const isCurrent = row.period_name === currentPeriod.period_name;
      if (isCurrent && row.calculation_status !== "FINALIZED") {
        return {
          ...row,
          display_status: "ONGOING",
          total_shu_distributed_amount: Number(liveSnapshot?.total_shu_distributed_amount || 0),
          total_manager_fund_amount: Number(liveSnapshot?.total_manager_fund_amount || 0),
          gross_profit_display: Number(liveSnapshot?.gross_profit_display || 0),
        };
      }

      return {
        ...row,
        display_status: isCurrent ? "ONGOING" : row.calculation_status || "NOT_CALCULATED",
      };
    });

    if (!mapped.some((row) => row.period_name === currentPeriod.period_name)) {
      mapped.unshift({
        id_shu_period: `virtual-${currentPeriod.period_name}`,
        period_name: currentPeriod.period_name,
        start_date: currentPeriod.start_date,
        end_date: currentPeriod.end_date,
        calculation_status: "DRAFT",
        display_status: "ONGOING",
        total_shu_distributed_amount: Number(liveSnapshot?.total_shu_distributed_amount || 0),
        total_manager_fund_amount: Number(liveSnapshot?.total_manager_fund_amount || 0),
        gross_profit_display: Number(liveSnapshot?.gross_profit_display || 0),
      });
    }

    return res.json({ data: mapped });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch SHU yearly summary.", error: error.message });
  }
};

module.exports = {
  getCurrentShuSimulation,
  calculateCurrentShu,
  finalizeCurrentShu,
  getCurrentShuResult,
  getCurrentShuDetail,
  getShuYearlySummary,
};

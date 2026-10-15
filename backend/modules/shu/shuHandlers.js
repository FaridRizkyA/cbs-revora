// HTTP handlers for the SHU page.
const pool = require("../../config/db");
const { logActivity } = require("../../utils/activityLogger");
const { getShuPeriodBounds } = require("../../utils/shuPeriodUtils");
const { enqueueShuNotificationJobs } = require("../emailQueue/emailQueue");
const { OFFICER_ROLE_ORDER_SQL, isFinalizeAllowed, ensurePeriod, calculateShuData, persistShuResult, getPeriodDetailTables } = require("./shuCalculation");

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
  const idUser = req.user.id_user;
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
  const idUser = req.user.id_user;
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

    // Enqueue SHU notification emails for members
    await enqueueShuNotificationJobs(client, {
      idShuPeriod: periodRow.id_shu_period,
      idUser,
    });

    await logActivity(client, req, {
      idUser,
      activityType: "FINALIZE_SHU",
      tableName: "tbl_shu_periods",
      recordId: periodRow.id_shu_period,
      description: `Finalized SHU period ${period.period_name} and queued notifications.`,
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
          d.eligible_business_shu,
          d.sales_shu_amount::float AS sales_shu_amount,
          d.business_shu_amount::float AS business_shu_amount,
          d.shu_amount::float AS shu_amount,
          d.distribution_status
        FROM tbl_shu_distributions d
        JOIN tbl_members m
          ON m.id_member = d.id_member
        LEFT JOIN tbl_profiles p
          ON p.id_user = m.id_user
        WHERE d.id_shu_period = $1
          AND d.is_active = 'Y'
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
          COALESCE(NULLIF(TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))), ''), s.staff_code) AS full_name,
          od.shu_amount::float AS shu_amount,
          od.distribution_status
        FROM tbl_shu_officer_distributions od
        LEFT JOIN tbl_staff s
          ON s.id_staff = od.id_staff
        LEFT JOIN tbl_profiles p
          ON p.id_user = s.id_user
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
  getCurrentShuDetail,
  getShuYearlySummary,
};

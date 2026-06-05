CREATE TABLE tbl_shu_periods (
    id_shu_period UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    period_name VARCHAR(100) NOT NULL UNIQUE,

    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    total_cooperative_income NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_member_spending NUMERIC(15, 2) NOT NULL DEFAULT 0,
    gross_profit_display NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- Sheet2-based SHU path snapshots (source of truth for calculation)
    income_belanja_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    expense_belanja_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    net_belanja_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    manager_cut_belanja_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    shu_belanja_pool_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,

    income_usaha_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    expense_usaha_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    net_usaha_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    manager_cut_usaha_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    shu_usaha_pool_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,

    total_shu_distributed_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_manager_fund_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    reconciliation_gap_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,

    calculation_status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',

    notes TEXT,

    is_active CHAR(1) NOT NULL DEFAULT 'Y',

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT fk_shu_periods_created_by
        FOREIGN KEY (created_by)
        REFERENCES tbl_users(id_user),

    CONSTRAINT chk_shu_periods_status
        CHECK (calculation_status IN ('DRAFT', 'CALCULATED', 'FINALIZED')),

    CONSTRAINT chk_shu_periods_income
        CHECK (total_cooperative_income >= 0),

    CONSTRAINT chk_shu_periods_member_spending
        CHECK (total_member_spending >= 0),

    CONSTRAINT chk_shu_periods_gross_profit_display
        CHECK (gross_profit_display >= 0),

    CONSTRAINT chk_shu_periods_income_belanja
        CHECK (income_belanja_amount >= 0),

    CONSTRAINT chk_shu_periods_expense_belanja
        CHECK (expense_belanja_amount >= 0),

    CONSTRAINT chk_shu_periods_net_belanja
        CHECK (net_belanja_amount >= 0),

    CONSTRAINT chk_shu_periods_manager_cut_belanja
        CHECK (manager_cut_belanja_amount >= 0),

    CONSTRAINT chk_shu_periods_shu_belanja_pool
        CHECK (shu_belanja_pool_amount >= 0),

    CONSTRAINT chk_shu_periods_income_usaha
        CHECK (income_usaha_amount >= 0),

    CONSTRAINT chk_shu_periods_expense_usaha
        CHECK (expense_usaha_amount >= 0),

    CONSTRAINT chk_shu_periods_net_usaha
        CHECK (net_usaha_amount >= 0),

    CONSTRAINT chk_shu_periods_manager_cut_usaha
        CHECK (manager_cut_usaha_amount >= 0),

    CONSTRAINT chk_shu_periods_shu_usaha_pool
        CHECK (shu_usaha_pool_amount >= 0),

    CONSTRAINT chk_shu_periods_total_shu_distributed
        CHECK (total_shu_distributed_amount >= 0),

    CONSTRAINT chk_shu_periods_total_manager_fund
        CHECK (total_manager_fund_amount >= 0),

    CONSTRAINT chk_shu_periods_date
        CHECK (start_date <= end_date),

    CONSTRAINT chk_shu_periods_is_active
        CHECK (is_active IN ('Y', 'N'))
);

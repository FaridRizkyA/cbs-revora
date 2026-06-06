CREATE TABLE tbl_shu_periods (
    id_shu_period UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    period_name VARCHAR(100) NOT NULL UNIQUE,

    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    total_cooperative_income NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_member_spending NUMERIC(15, 2) NOT NULL DEFAULT 0,
    gross_profit_display NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- Sheet2-based SHU path snapshots (source of truth for calculation)
    sales_income_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    sales_cost_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    sales_net_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    sales_manager_cut_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    sales_shu_pool_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,

    business_income_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    business_expense_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    business_net_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    business_manager_cut_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    business_shu_pool_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,

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

    CONSTRAINT chk_shu_periods_sales_income
        CHECK (sales_income_amount >= 0),

    CONSTRAINT chk_shu_periods_sales_cost
        CHECK (sales_cost_amount >= 0),

    CONSTRAINT chk_shu_periods_sales_net
        CHECK (sales_net_amount >= 0),

    CONSTRAINT chk_shu_periods_sales_manager_cut
        CHECK (sales_manager_cut_amount >= 0),

    CONSTRAINT chk_shu_periods_sales_shu_pool
        CHECK (sales_shu_pool_amount >= 0),

    CONSTRAINT chk_shu_periods_business_income
        CHECK (business_income_amount >= 0),

    CONSTRAINT chk_shu_periods_business_expense
        CHECK (business_expense_amount >= 0),

    CONSTRAINT chk_shu_periods_business_net
        CHECK (business_net_amount >= 0),

    CONSTRAINT chk_shu_periods_business_manager_cut
        CHECK (business_manager_cut_amount >= 0),

    CONSTRAINT chk_shu_periods_business_shu_pool
        CHECK (business_shu_pool_amount >= 0),

    CONSTRAINT chk_shu_periods_total_shu_distributed
        CHECK (total_shu_distributed_amount >= 0),

    CONSTRAINT chk_shu_periods_total_manager_fund
        CHECK (total_manager_fund_amount >= 0),

    CONSTRAINT chk_shu_periods_date
        CHECK (start_date <= end_date),

    CONSTRAINT chk_shu_periods_is_active
        CHECK (is_active IN ('Y', 'N'))
);

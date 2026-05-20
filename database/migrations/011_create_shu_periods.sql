CREATE TABLE tbl_shu_periods (
    id_shu_period UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    period_name VARCHAR(100) NOT NULL UNIQUE,

    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    total_cooperative_income NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_member_spending NUMERIC(15, 2) NOT NULL DEFAULT 0,

    shu_pool_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,

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

    CONSTRAINT chk_shu_periods_shu_pool
        CHECK (shu_pool_amount >= 0),

    CONSTRAINT chk_shu_periods_date
        CHECK (start_date <= end_date),

    CONSTRAINT chk_shu_periods_is_active
        CHECK (is_active IN ('Y', 'N'))
);
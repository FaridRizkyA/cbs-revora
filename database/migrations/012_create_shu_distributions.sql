CREATE TABLE tbl_shu_distributions (
    id_shu_distribution UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    id_shu_period UUID NOT NULL,
    id_member UUID NOT NULL,

    member_total_spending NUMERIC(15, 2) NOT NULL DEFAULT 0,
    spending_percentage NUMERIC(8, 4) NOT NULL DEFAULT 0,

    shu_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,

    distribution_status VARCHAR(30) NOT NULL DEFAULT 'CALCULATED',
    distributed_date TIMESTAMP,

    notes TEXT,

    is_active CHAR(1) NOT NULL DEFAULT 'Y',

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT fk_shu_distributions_period
        FOREIGN KEY (id_shu_period)
        REFERENCES tbl_shu_periods(id_shu_period),

    CONSTRAINT fk_shu_distributions_member
        FOREIGN KEY (id_member)
        REFERENCES tbl_members(id_member),

    CONSTRAINT fk_shu_distributions_created_by
        FOREIGN KEY (created_by)
        REFERENCES tbl_users(id_user),

    CONSTRAINT uq_shu_distributions_period_member
        UNIQUE (id_shu_period, id_member),

    CONSTRAINT chk_shu_distributions_member_spending
        CHECK (member_total_spending >= 0),

    CONSTRAINT chk_shu_distributions_percentage
        CHECK (spending_percentage >= 0),

    CONSTRAINT chk_shu_distributions_amount
        CHECK (shu_amount >= 0),

    CONSTRAINT chk_shu_distributions_status
        CHECK (distribution_status IN ('CALCULATED', 'DISTRIBUTED', 'CANCELLED')),

    CONSTRAINT chk_shu_distributions_is_active
        CHECK (is_active IN ('Y', 'N'))
);
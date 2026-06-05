CREATE TABLE IF NOT EXISTS tbl_shu_officer_distributions (
    id_shu_officer_distribution UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    id_shu_period UUID NOT NULL,
    id_staff UUID NOT NULL,
    officer_role_code VARCHAR(30) NOT NULL,

    shu_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    distribution_status VARCHAR(30) NOT NULL DEFAULT 'CALCULATED',
    distributed_date TIMESTAMP,
    notes TEXT,

    is_active CHAR(1) NOT NULL DEFAULT 'Y',

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT fk_shu_officer_distributions_period
        FOREIGN KEY (id_shu_period)
        REFERENCES tbl_shu_periods(id_shu_period),

    CONSTRAINT fk_shu_officer_distributions_staff
        FOREIGN KEY (id_staff)
        REFERENCES tbl_staff(id_staff),

    CONSTRAINT chk_shu_officer_role_code
        CHECK (officer_role_code IN ('CHAIRPERSON', 'VICE_CHAIRPERSON', 'TREASURER')),

    CONSTRAINT chk_shu_officer_amount
        CHECK (shu_amount >= 0),

    CONSTRAINT chk_shu_officer_status
        CHECK (distribution_status IN ('CALCULATED', 'DISTRIBUTED', 'CANCELLED')),

    CONSTRAINT chk_shu_officer_is_active
        CHECK (is_active IN ('Y', 'N'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_shu_officer_period_staff
    ON tbl_shu_officer_distributions (id_shu_period, id_staff)
    WHERE is_active = 'Y';

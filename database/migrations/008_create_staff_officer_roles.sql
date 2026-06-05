CREATE TABLE IF NOT EXISTS tbl_staff_officer_roles (
    id_staff_officer_role UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    id_staff UUID NOT NULL,
    officer_role_code VARCHAR(30) NOT NULL,

    effective_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_end_date DATE,

    is_shu_eligible CHAR(1) NOT NULL DEFAULT 'Y',
    is_active CHAR(1) NOT NULL DEFAULT 'Y',

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT fk_staff_officer_roles_staff
        FOREIGN KEY (id_staff)
        REFERENCES tbl_staff(id_staff),

    CONSTRAINT chk_staff_officer_role_code
        CHECK (officer_role_code IN ('CHAIRPERSON', 'VICE_CHAIRPERSON', 'TREASURER', 'SUPERVISOR', 'ADVISOR')),

    CONSTRAINT chk_staff_officer_dates
        CHECK (effective_end_date IS NULL OR effective_start_date <= effective_end_date),

    CONSTRAINT chk_staff_officer_shu_eligible
        CHECK (is_shu_eligible IN ('Y', 'N')),

    CONSTRAINT chk_staff_officer_is_active
        CHECK (is_active IN ('Y', 'N'))
);

CREATE INDEX IF NOT EXISTS idx_staff_officer_role_active
    ON tbl_staff_officer_roles (officer_role_code, is_active, is_shu_eligible);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_officer_role_open_ended
    ON tbl_staff_officer_roles (id_staff, officer_role_code)
    WHERE effective_end_date IS NULL AND is_active = 'Y';

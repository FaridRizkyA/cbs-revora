CREATE TABLE IF NOT EXISTS tbl_staff (
    id_staff UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    id_user UUID NOT NULL UNIQUE,
    id_staff_grade UUID,

    staff_code VARCHAR(50) UNIQUE,
    join_date DATE NOT NULL DEFAULT CURRENT_DATE,
    exit_date DATE,

    is_active CHAR(1) NOT NULL DEFAULT 'Y',

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT fk_staff_user
        FOREIGN KEY (id_user)
        REFERENCES tbl_users(id_user),

    CONSTRAINT fk_staff_grade
        FOREIGN KEY (id_staff_grade)
        REFERENCES tbl_staff_grades(id_staff_grade),

    CONSTRAINT chk_staff_dates
        CHECK (exit_date IS NULL OR join_date <= exit_date),

    CONSTRAINT chk_staff_is_active
        CHECK (is_active IN ('Y', 'N'))
);

CREATE INDEX IF NOT EXISTS idx_staff_active
    ON tbl_staff (is_active);

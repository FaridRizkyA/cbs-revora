CREATE TABLE IF NOT EXISTS tbl_staff_grades (
    id_staff_grade UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    grade_code VARCHAR(30) NOT NULL UNIQUE,
    grade_name VARCHAR(100) NOT NULL,
    grade_order INTEGER NOT NULL DEFAULT 0,
    description TEXT,

    is_active CHAR(1) NOT NULL DEFAULT 'Y',

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT chk_staff_grades_order
        CHECK (grade_order >= 0),

    CONSTRAINT chk_staff_grades_is_active
        CHECK (is_active IN ('Y', 'N'))
);

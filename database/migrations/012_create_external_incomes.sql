CREATE TABLE tbl_external_incomes (
    id_external_income UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    income_date DATE NOT NULL DEFAULT CURRENT_DATE,

    income_source VARCHAR(100) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,

    notes TEXT,

    is_active CHAR(1) NOT NULL DEFAULT 'Y',

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT fk_external_incomes_created_by
        FOREIGN KEY (created_by)
        REFERENCES tbl_users(id_user),

    CONSTRAINT chk_external_incomes_amount
        CHECK (amount > 0),

    CONSTRAINT chk_external_incomes_is_active
        CHECK (is_active IN ('Y', 'N'))
);
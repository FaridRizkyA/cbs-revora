CREATE TABLE tbl_external_financial_entries (
    id_external_entry UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    entry_type VARCHAR(20) NOT NULL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,

    entry_source VARCHAR(100) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,

    notes TEXT,

    is_active CHAR(1) NOT NULL DEFAULT 'Y',

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT fk_external_financial_entries_created_by
        FOREIGN KEY (created_by)
        REFERENCES tbl_users(id_user),

    CONSTRAINT chk_external_financial_entries_type
        CHECK (entry_type IN ('INCOME', 'OUTCOME')),

    CONSTRAINT chk_external_financial_entries_amount
        CHECK (amount > 0),

    CONSTRAINT chk_external_financial_entries_is_active
        CHECK (is_active IN ('Y', 'N'))
);

CREATE INDEX IF NOT EXISTS idx_external_financial_entries_type_date
    ON tbl_external_financial_entries (entry_type, entry_date);

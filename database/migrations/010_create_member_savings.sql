CREATE TABLE tbl_member_savings (
    id_member_saving UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    id_member UUID NOT NULL,

    saving_type VARCHAR(30) NOT NULL,
    transaction_type VARCHAR(30) NOT NULL,

    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,

    transaction_date TIMESTAMP NOT NULL DEFAULT NOW(),

    notes TEXT,

    is_active CHAR(1) NOT NULL DEFAULT 'Y',

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT fk_member_savings_member
        FOREIGN KEY (id_member)
        REFERENCES tbl_members(id_member),

    CONSTRAINT fk_member_savings_created_by
        FOREIGN KEY (created_by)
        REFERENCES tbl_users(id_user),

    CONSTRAINT chk_member_savings_type
        CHECK (saving_type IN ('POKOK', 'WAJIB', 'SUKARELA')),

    CONSTRAINT chk_member_savings_transaction_type
        CHECK (transaction_type IN ('DEPOSIT', 'WITHDRAWAL', 'ADJUSTMENT')),

    CONSTRAINT chk_member_savings_amount
        CHECK (amount > 0),

    CONSTRAINT chk_member_savings_is_active
        CHECK (is_active IN ('Y', 'N'))
);
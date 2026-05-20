CREATE TABLE tbl_members (
    id_member UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    id_user UUID,

    member_code VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(30),
    address TEXT,

    join_date DATE NOT NULL DEFAULT CURRENT_DATE,

    shopping_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_spending NUMERIC(15, 2) NOT NULL DEFAULT 0,

    is_active CHAR(1) NOT NULL DEFAULT 'Y',

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT fk_members_user
        FOREIGN KEY (id_user)
        REFERENCES tbl_users(id_user),

    CONSTRAINT chk_members_shopping_balance
        CHECK (shopping_balance >= 0),

    CONSTRAINT chk_members_total_spending
        CHECK (total_spending >= 0),

    CONSTRAINT chk_members_is_active
        CHECK (is_active IN ('Y', 'N'))
);
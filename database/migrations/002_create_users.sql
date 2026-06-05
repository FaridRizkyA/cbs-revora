CREATE TABLE tbl_users (
    id_user UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,

    is_active CHAR(1) NOT NULL DEFAULT 'Y',

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT chk_users_is_active
        CHECK (is_active IN ('Y', 'N'))
);

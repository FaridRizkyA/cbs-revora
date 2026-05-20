CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tbl_roles (
    id_role UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    role_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_active CHAR(1) NOT NULL DEFAULT 'Y',

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT chk_roles_is_active
        CHECK (is_active IN ('Y', 'N'))
);
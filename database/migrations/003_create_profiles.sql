CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tbl_profiles (
    id_profile UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    id_user UUID UNIQUE,

    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(80),
    phone_number VARCHAR(30),
    address TEXT,
    profile_image TEXT,

    is_active CHAR(1) NOT NULL DEFAULT 'Y',

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT fk_profiles_user
        FOREIGN KEY (id_user)
        REFERENCES tbl_users(id_user),

    CONSTRAINT chk_profiles_is_active
        CHECK (is_active IN ('Y', 'N'))
);

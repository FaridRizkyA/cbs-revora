CREATE TABLE tbl_users (
    id_user UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    id_role UUID NOT NULL,

    full_name VARCHAR(150) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(150) UNIQUE,
    password_hash TEXT NOT NULL,

    phone_number VARCHAR(30),
    address TEXT,
    profile_image TEXT,

    is_active CHAR(1) NOT NULL DEFAULT 'Y',

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT fk_users_role
        FOREIGN KEY (id_role)
        REFERENCES tbl_roles(id_role),

    CONSTRAINT chk_users_is_active
        CHECK (is_active IN ('Y', 'N'))
);
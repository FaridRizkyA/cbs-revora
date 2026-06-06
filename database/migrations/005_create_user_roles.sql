CREATE TABLE IF NOT EXISTS tbl_user_roles (
    id_user_role UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    id_user UUID NOT NULL,
    id_role UUID NOT NULL,

    effective_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_end_date DATE,

    is_active CHAR(1) NOT NULL DEFAULT 'Y',

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT fk_user_roles_user
        FOREIGN KEY (id_user)
        REFERENCES tbl_users(id_user),

    CONSTRAINT fk_user_roles_role
        FOREIGN KEY (id_role)
        REFERENCES tbl_roles(id_role),

    CONSTRAINT uq_user_roles_pair
        UNIQUE (id_user, id_role),

    CONSTRAINT chk_user_roles_effective_date
        CHECK (effective_end_date IS NULL OR effective_start_date <= effective_end_date),

    CONSTRAINT chk_user_roles_is_active
        CHECK (is_active IN ('Y', 'N'))
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_active
    ON tbl_user_roles (id_user, is_active);

CREATE INDEX IF NOT EXISTS idx_user_roles_role_active
    ON tbl_user_roles (id_role, is_active);

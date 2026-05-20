CREATE TABLE tbl_activity_logs (
    id_activity_log UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    id_user UUID,

    activity_type VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id UUID,

    description TEXT,

    activity_date TIMESTAMP NOT NULL DEFAULT NOW(),

    ip_address VARCHAR(50),
    user_agent TEXT,

    is_active CHAR(1) NOT NULL DEFAULT 'Y',

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT fk_activity_logs_user
        FOREIGN KEY (id_user)
        REFERENCES tbl_users(id_user),

    CONSTRAINT fk_activity_logs_created_by
        FOREIGN KEY (created_by)
        REFERENCES tbl_users(id_user),

    CONSTRAINT chk_activity_logs_is_active
        CHECK (is_active IN ('Y', 'N'))
);
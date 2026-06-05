CREATE TABLE tbl_email_logs (
    id_email_log UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    id_user UUID,
    id_member UUID,

    email_to VARCHAR(150) NOT NULL,
    email_subject VARCHAR(255) NOT NULL,

    email_type VARCHAR(50) NOT NULL,
    email_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    sent_date TIMESTAMP,
    failed_reason TEXT,
    attempt_count INT NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMP,

    reference_table VARCHAR(100),
    reference_id UUID,

    is_active CHAR(1) NOT NULL DEFAULT 'Y',

    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    last_modify_date TIMESTAMP,
    last_modify_by UUID,

    CONSTRAINT fk_email_logs_user
        FOREIGN KEY (id_user)
        REFERENCES tbl_users(id_user),

    CONSTRAINT fk_email_logs_member
        FOREIGN KEY (id_member)
        REFERENCES tbl_members(id_member),

    CONSTRAINT fk_email_logs_created_by
        FOREIGN KEY (created_by)
        REFERENCES tbl_users(id_user),

    CONSTRAINT chk_email_logs_type
        CHECK (email_type IN ('SALE_RECEIPT', 'MONTHLY_REPORT', 'SHU_NOTIFICATION', 'OTHER')),

    CONSTRAINT chk_email_logs_status
        CHECK (email_status IN ('PENDING', 'SENT', 'FAILED')),

    CONSTRAINT chk_email_logs_is_active
        CHECK (is_active IN ('Y', 'N'))
);

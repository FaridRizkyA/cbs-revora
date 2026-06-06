CREATE TABLE tbl_password_reset_otps (
    id_password_reset_otp UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_user UUID NOT NULL
        REFERENCES tbl_users(id_user),
    email VARCHAR(150) NOT NULL,
    otp_hash TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP,
    used_at TIMESTAMP,
    created_date TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_otps_user
    ON tbl_password_reset_otps(id_user, created_date DESC);


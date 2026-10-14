-- Wrong OTP guesses are counted per OTP so it can be invalidated after too many attempts.
ALTER TABLE tbl_password_reset_otps
    ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;

-- Supports counting recent failed logins per account for the login lockout.
CREATE INDEX IF NOT EXISTS idx_activity_logs_type_record_date
    ON tbl_activity_logs (activity_type, record_id, created_date DESC);

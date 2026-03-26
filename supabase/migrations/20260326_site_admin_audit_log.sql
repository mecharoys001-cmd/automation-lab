-- Audit log for site admin role changes
CREATE TABLE IF NOT EXISTS site_admin_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  target_admin_id UUID,
  target_email TEXT NOT NULL,
  acting_user_email TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_site_admin_audit_log_created ON site_admin_audit_log(created_at DESC);
CREATE INDEX idx_site_admin_audit_log_target ON site_admin_audit_log(target_email);

ALTER TABLE site_admin_audit_log ENABLE ROW LEVEL SECURITY;

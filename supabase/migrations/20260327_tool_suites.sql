-- Tool Suites: grouped tool access with delegated management
-- See docs/superpowers/plans/2026-03-27-tool-suites-access-control.md

-- 1. tool_suites — named groups of tools
CREATE TABLE tool_suites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. tool_suite_tools — which tools belong to which suite
CREATE TABLE tool_suite_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id UUID NOT NULL REFERENCES tool_suites(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (suite_id, tool_id)
);

-- 3. tool_suite_members — which users belong to which suite
CREATE TABLE tool_suite_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id UUID NOT NULL REFERENCES tool_suites(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'manager')),
  granted_by TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (suite_id, user_email)
);

-- Indexes
CREATE INDEX idx_tool_suite_tools_suite_id ON tool_suite_tools(suite_id);
CREATE INDEX idx_tool_suite_tools_tool_id ON tool_suite_tools(tool_id);
CREATE INDEX idx_tool_suite_members_suite_id ON tool_suite_members(suite_id);
CREATE INDEX idx_tool_suite_members_user_email ON tool_suite_members(user_email);

-- Enable RLS
ALTER TABLE tool_suites ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_suite_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_suite_members ENABLE ROW LEVEL SECURITY;

-- Enable UUID support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users (no org FK yet)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NULL,
  google_id TEXT NULL,
  role TEXT NOT NULL CHECK (role IN ('INDIVIDUAL', 'OWNER', 'ADMIN')),
  credits INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_user_id UUID UNIQUE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add circular foreign keys AFTER
ALTER TABLE users
  ADD CONSTRAINT users_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_owner_user_id_fkey
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Credit purchases
CREATE TABLE IF NOT EXISTS credit_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_key TEXT NOT NULL,
  credits_added INTEGER NOT NULL CHECK (credits_added > 0),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Usage logs
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_key TEXT NOT NULL,
  credits_charged INTEGER NOT NULL CHECK (credits_charged > 0),
  input_chars INTEGER NOT NULL DEFAULT 0,
  output_chars INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
  error_message TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Session table
CREATE TABLE IF NOT EXISTS "session" (
  sid varchar PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);

-- Indexes (LAST)
CREATE INDEX IF NOT EXISTS idx_session_expire ON "session" (expire);
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users (org_id);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_user_time
  ON credit_purchases (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_time
  ON usage_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_tool_time
  ON usage_logs (tool_key, created_at DESC);

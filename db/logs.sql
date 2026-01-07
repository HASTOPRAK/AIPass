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

CREATE INDEX IF NOT EXISTS idx_usage_logs_user_time
  ON usage_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_logs_tool_time
  ON usage_logs (tool_key, created_at DESC);

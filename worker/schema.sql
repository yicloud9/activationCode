-- 管理员表
CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    api_key TEXT NOT NULL,
    api_secret TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 激活码表
CREATE TABLE IF NOT EXISTS activation_codes (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    admin_id TEXT NOT NULL,
    app_name TEXT NOT NULL,
    user_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'activated', 'expired', 'revoked')),
    duration_hours INTEGER NOT NULL,
    activated_at TEXT,
    expired_at TEXT,
    request_count INTEGER DEFAULT 0,
    remark TEXT,
    deleted_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (admin_id) REFERENCES admins(id)
);

-- 操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('login', 'generate_code', 'revoke_code', 'delete_code', 'export_codes', 'regenerate_secret')),
    target_type TEXT NOT NULL,
    target_id TEXT,
    details TEXT,
    ip TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (admin_id) REFERENCES admins(id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_codes_admin_id ON activation_codes(admin_id);
CREATE INDEX IF NOT EXISTS idx_codes_code ON activation_codes(code);
CREATE INDEX IF NOT EXISTS idx_codes_status ON activation_codes(status);
CREATE INDEX IF NOT EXISTS idx_codes_app_name ON activation_codes(app_name);
CREATE INDEX IF NOT EXISTS idx_codes_deleted_at ON activation_codes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_logs_admin_id ON operation_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON operation_logs(created_at);

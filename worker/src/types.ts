// 预处理语句接口 (兼容 D1 和 better-sqlite3)
export interface PreparedStatement {
  bind: (...params: any[]) => {
    run: () => any;
    first: <T>() => T | undefined;
    all: <T>() => { results: T[] };
  };
  run: () => any;
  first: <T>() => T | undefined;
  all: <T>() => { results: T[] };
}

// 数据库接口 (兼容 D1 和 better-sqlite3)
export interface DBInterface {
  prepare: (sql: string) => PreparedStatement;
}

// KV 接口 (兼容 Cloudflare KV 和 Redis)
export interface KVInterface {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
}

// 环境变量接口
export interface Env {
  DB: DBInterface;
  NONCE_KV: KVInterface;
  JWT_SECRET: string;
  CORS_ORIGIN: string;
}

export interface Admin {
  id: string;
  username: string;
  password_hash: string;
  api_key: string;
  api_secret: string;
  created_at: string;
  updated_at: string;
}

export interface ActivationCode {
  id: string;
  code: string;
  admin_id: string;
  app_name: string;
  user_name: string;
  status: 'pending' | 'activated' | 'expired' | 'revoked';
  duration_hours: number;
  activated_at: string | null;
  expired_at: string | null;
  request_count: number;
  remark: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OperationLog {
  id: string;
  admin_id: string;
  action: 'login' | 'generate_code' | 'revoke_code' | 'delete_code' | 'export_codes' | 'regenerate_secret';
  target_type: string;
  target_id: string | null;
  details: string | null;
  ip: string;
  created_at: string;
}

export interface JwtPayload {
  sub: string;
  username: string;
  exp: number;
  iat: number;
}

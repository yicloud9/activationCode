import { createDB } from './db';
import { createKV } from './cache';

// 创建环境变量对象，适配 Cloudflare Workers 的 Env 接口
export const createEnv = () => ({
  DB: createDB(),
  NONCE_KV: createKV(),
  JWT_SECRET: process.env.JWT_SECRET || 'change-this-secret-in-production',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
});

export type NodeEnv = ReturnType<typeof createEnv>;

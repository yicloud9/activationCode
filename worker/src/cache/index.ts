import Redis from 'ioredis';

// 初始化 Redis 连接
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl);

// 适配 Cloudflare KV API
export const createKV = () => ({
  get: async (key: string): Promise<string | null> => {
    return await redis.get(key);
  },
  put: async (key: string, value: string, options?: { expirationTtl?: number }): Promise<void> => {
    if (options?.expirationTtl) {
      await redis.setex(key, options.expirationTtl, value);
    } else {
      await redis.set(key, value);
    }
  },
});

// 导出 Redis 实例供其他用途
export { redis };

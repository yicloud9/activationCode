import { Context, Next } from 'hono';
import { verifyJwt } from '../utils/crypto';
import { Env, JwtPayload } from '../types';

// 扩展 Hono Context 类型
declare module 'hono' {
  interface ContextVariableMap {
    adminId: string;
    adminUsername: string;
  }
}

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyJwt(token, c.env.JWT_SECRET) as JwtPayload | null;

  if (!payload) {
    return c.json({ success: false, error: 'Token 无效或已过期' }, 401);
  }

  c.set('adminId', payload.sub);
  c.set('adminUsername', payload.username);

  await next();
}

import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createEnv, NodeEnv } from './src/env';
import {
  verifyPassword,
  hashPassword,
  generateJwt,
  generateUUID,
  getClientIp,
  generateApiKey,
  generateApiSecret,
} from './src/utils/crypto';
import { authMiddleware } from './src/middleware/auth';
import codesRoutes from './src/routes/codes';
import statsRoutes from './src/routes/stats';
import logsRoutes from './src/routes/logs';
import verifyRoutes from './src/routes/verify';
import { Admin } from './src/types';

// 创建环境
const env = createEnv();

// 创建 Hono 应用
const app = new Hono<{ Bindings: NodeEnv }>();

// 注入环境变量中间件
app.use('*', async (c, next) => {
  c.env = env as any;
  await next();
});

// CORS 中间件
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Disposition'],
  maxAge: 86400,
}));

// 健康检查
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 消费端 API (不需要认证)
app.route('/api/v1', verifyRoutes);

// ===== 管理端公开接口 =====

// 初始化管理员 (仅当没有管理员时可用)
app.post('/admin/init', async (c) => {
  try {
    const existingAdmin = c.env.DB.prepare('SELECT COUNT(*) as count FROM admins').first<{ count: number }>();
    if (existingAdmin && existingAdmin.count > 0) {
      return c.json({ success: false, error: '系统已初始化，无法重复创建管理员' }, 403);
    }

    const { username, password } = await c.req.json();

    if (!username || !password) {
      return c.json({ success: false, error: '用户名和密码不能为空' }, 400);
    }

    if (password.length < 6) {
      return c.json({ success: false, error: '密码长度不能少于6位' }, 400);
    }

    const id = generateUUID();
    const passwordHash = await hashPassword(password);
    const apiKey = generateApiKey();
    const apiSecret = generateApiSecret();

    c.env.DB.prepare(
      `INSERT INTO admins (id, username, password_hash, api_key, api_secret, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(id, username, passwordHash, apiKey, apiSecret).run();

    return c.json({
      success: true,
      message: '管理员创建成功',
      data: { username, api_key: apiKey },
    });
  } catch (error) {
    console.error('Init admin error:', error);
    return c.json({ success: false, error: '初始化失败' }, 500);
  }
});

// 登录
app.post('/admin/login', async (c) => {
  try {
    const { username, password } = await c.req.json();

    if (!username || !password) {
      return c.json({ success: false, error: '用户名和密码不能为空' }, 400);
    }

    const admin = c.env.DB.prepare(
      'SELECT * FROM admins WHERE username = ?'
    ).bind(username).first<Admin>();

    if (!admin) {
      return c.json({ success: false, error: '用户名或密码错误' }, 401);
    }

    const validPassword = await verifyPassword(password, admin.password_hash);
    if (!validPassword) {
      return c.json({ success: false, error: '用户名或密码错误' }, 401);
    }

    const token = await generateJwt(
      { sub: admin.id, username: admin.username },
      c.env.JWT_SECRET,
      86400
    );

    c.env.DB.prepare(
      `INSERT INTO operation_logs (id, admin_id, action, target_type, target_id, details, ip, created_at)
       VALUES (?, ?, 'login', 'admin', ?, ?, ?, datetime('now'))`
    ).bind(generateUUID(), admin.id, admin.id, JSON.stringify({ username: admin.username }), getClientIp(c.req.raw)).run();

    return c.json({
      success: true,
      data: { token, admin: { id: admin.id, username: admin.username } },
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ success: false, error: '登录失败' }, 500);
  }
});

app.post('/admin/logout', (c) => c.json({ success: true, message: '已登出' }));

// ===== 管理端受保护接口 =====
const adminApp = new Hono<{ Bindings: NodeEnv }>();
adminApp.use('*', authMiddleware);

// 修改密码
adminApp.put('/password', async (c) => {
  try {
    const adminId = c.get('adminId');
    const { oldPassword, newPassword } = await c.req.json();

    if (!oldPassword || !newPassword) {
      return c.json({ success: false, error: '旧密码和新密码不能为空' }, 400);
    }

    if (newPassword.length < 6) {
      return c.json({ success: false, error: '新密码长度不能少于6位' }, 400);
    }

    const admin = c.env.DB.prepare('SELECT * FROM admins WHERE id = ?').bind(adminId).first<Admin>();
    if (!admin) return c.json({ success: false, error: '用户不存在' }, 404);

    const validPassword = await verifyPassword(oldPassword, admin.password_hash);
    if (!validPassword) return c.json({ success: false, error: '旧密码错误' }, 401);

    const newPasswordHash = await hashPassword(newPassword);
    c.env.DB.prepare(`UPDATE admins SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).bind(newPasswordHash, adminId).run();

    return c.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('Password change error:', error);
    return c.json({ success: false, error: '密码修改失败' }, 500);
  }
});

// API 密钥
adminApp.get('/api-keys', async (c) => {
  try {
    const adminId = c.get('adminId');
    const admin = c.env.DB.prepare('SELECT api_key, api_secret FROM admins WHERE id = ?').bind(adminId).first<Pick<Admin, 'api_key' | 'api_secret'>>();
    if (!admin) return c.json({ success: false, error: '用户不存在' }, 404);
    return c.json({ success: true, data: { api_key: admin.api_key, api_secret: admin.api_secret } });
  } catch (error) {
    console.error('Get API keys error:', error);
    return c.json({ success: false, error: '获取 API 密钥失败' }, 500);
  }
});

adminApp.post('/api-keys/regenerate', async (c) => {
  try {
    const adminId = c.get('adminId');
    const newApiKey = generateApiKey();
    const newSecret = generateApiSecret();

    c.env.DB.prepare(`UPDATE admins SET api_key = ?, api_secret = ?, updated_at = datetime('now') WHERE id = ?`).bind(newApiKey, newSecret, adminId).run();

    c.env.DB.prepare(
      `INSERT INTO operation_logs (id, admin_id, action, target_type, target_id, details, ip, created_at)
       VALUES (?, ?, 'regenerate_secret', 'admin', ?, ?, ?, datetime('now'))`
    ).bind(generateUUID(), adminId, adminId, JSON.stringify({ message: 'API Key/Secret 已重新生成' }), getClientIp(c.req.raw)).run();

    return c.json({ success: true, data: { api_key: newApiKey, api_secret: newSecret }, message: 'API 密钥已重新生成' });
  } catch (error) {
    console.error('Regenerate secret error:', error);
    return c.json({ success: false, error: '重新生成 API 密钥失败' }, 500);
  }
});

// 激活码、统计、日志
adminApp.route('/codes', codesRoutes);
adminApp.route('/stats', statsRoutes);
adminApp.route('/logs', logsRoutes);

app.route('/admin', adminApp);

// 404 处理
app.notFound((c) => c.json({ success: false, error: '接口不存在' }, 404));

// 错误处理
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({ success: false, error: '服务器错误' }, 500);
});

// 启动服务器
const port = parseInt(process.env.PORT || '3000');
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🚀 Server running on http://localhost:${info.port}`);
});

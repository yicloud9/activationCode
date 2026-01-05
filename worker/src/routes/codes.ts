import { Hono } from 'hono';
import { Env, ActivationCode } from '../types';
import { generateUUID, generateActivationCode, getClientIp } from '../utils/crypto';

const codes = new Hono<{ Bindings: Env }>();

// 生成激活码
codes.post('/', async (c) => {
  try {
    const adminId = c.get('adminId');
    const { app_name, user_name, duration_hours, remark } = await c.req.json();

    if (!app_name || !user_name || !duration_hours) {
      return c.json({ success: false, error: 'APP 名称、用户名称和有效时长不能为空' }, 400);
    }

    if (duration_hours <= 0) {
      return c.json({ success: false, error: '有效时长必须大于 0' }, 400);
    }

    // 生成唯一激活码
    let code: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      code = generateActivationCode();
      const existing = await c.env.DB.prepare(
        'SELECT id FROM activation_codes WHERE code = ?'
      ).bind(code).first();

      if (!existing) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      return c.json({ success: false, error: '生成激活码失败，请重试' }, 500);
    }

    const id = generateUUID();

    await c.env.DB.prepare(
      `INSERT INTO activation_codes (id, code, admin_id, app_name, user_name, status, duration_hours, remark, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, datetime('now'), datetime('now'))`
    ).bind(id, code, adminId, app_name, user_name, duration_hours, remark || null).run();

    // 记录操作日志
    await c.env.DB.prepare(
      `INSERT INTO operation_logs (id, admin_id, action, target_type, target_id, details, ip, created_at)
       VALUES (?, ?, 'generate_code', 'activation_code', ?, ?, ?, datetime('now'))`
    ).bind(
      generateUUID(),
      adminId,
      id,
      JSON.stringify({ code, app_name, user_name, duration_hours }),
      getClientIp(c.req.raw)
    ).run();

    return c.json({
      success: true,
      data: {
        id,
        code,
        app_name,
        user_name,
        status: 'pending',
        duration_hours,
        remark,
      },
    });
  } catch (error) {
    console.error('Generate code error:', error);
    return c.json({ success: false, error: '生成激活码失败' }, 500);
  }
});

// 激活码列表
codes.get('/', async (c) => {
  try {
    const adminId = c.get('adminId');
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '10');
    const code = c.req.query('code');
    const app_name = c.req.query('app_name');
    const user_name = c.req.query('user_name');
    const status = c.req.query('status');
    const start_date = c.req.query('start_date');
    const end_date = c.req.query('end_date');

    let whereClause = 'admin_id = ? AND deleted_at IS NULL';
    const params: any[] = [adminId];

    if (code) {
      whereClause += ' AND code LIKE ?';
      params.push(`%${code}%`);
    }
    if (app_name) {
      whereClause += ' AND app_name LIKE ?';
      params.push(`%${app_name}%`);
    }
    if (user_name) {
      whereClause += ' AND user_name LIKE ?';
      params.push(`%${user_name}%`);
    }
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    if (start_date) {
      whereClause += ' AND created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND created_at <= ?';
      params.push(end_date + ' 23:59:59');
    }

    // 获取总数
    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM activation_codes WHERE ${whereClause}`
    ).bind(...params).first<{ total: number }>();

    const total = countResult?.total || 0;

    // 获取列表
    const offset = (page - 1) * pageSize;
    const listResult = await c.env.DB.prepare(
      `SELECT * FROM activation_codes WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, pageSize, offset).all<ActivationCode>();

    return c.json({
      success: true,
      data: {
        list: listResult.results || [],
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('Get codes error:', error);
    return c.json({ success: false, error: '获取激活码列表失败' }, 500);
  }
});

// 激活码详情
codes.get('/:id', async (c) => {
  try {
    const adminId = c.get('adminId');
    const id = c.req.param('id');

    const code = await c.env.DB.prepare(
      'SELECT * FROM activation_codes WHERE id = ? AND admin_id = ? AND deleted_at IS NULL'
    ).bind(id, adminId).first<ActivationCode>();

    if (!code) {
      return c.json({ success: false, error: '激活码不存在' }, 404);
    }

    return c.json({ success: true, data: code });
  } catch (error) {
    console.error('Get code detail error:', error);
    return c.json({ success: false, error: '获取激活码详情失败' }, 500);
  }
});

// 作废激活码
codes.put('/:id/revoke', async (c) => {
  try {
    const adminId = c.get('adminId');
    const id = c.req.param('id');

    const code = await c.env.DB.prepare(
      'SELECT * FROM activation_codes WHERE id = ? AND admin_id = ? AND deleted_at IS NULL'
    ).bind(id, adminId).first<ActivationCode>();

    if (!code) {
      return c.json({ success: false, error: '激活码不存在' }, 404);
    }

    if (code.status === 'revoked') {
      return c.json({ success: false, error: '激活码已经被作废' }, 400);
    }

    await c.env.DB.prepare(
      `UPDATE activation_codes SET status = 'revoked', updated_at = datetime('now') WHERE id = ?`
    ).bind(id).run();

    // 记录操作日志
    await c.env.DB.prepare(
      `INSERT INTO operation_logs (id, admin_id, action, target_type, target_id, details, ip, created_at)
       VALUES (?, ?, 'revoke_code', 'activation_code', ?, ?, ?, datetime('now'))`
    ).bind(
      generateUUID(),
      adminId,
      id,
      JSON.stringify({ code: code.code, previous_status: code.status }),
      getClientIp(c.req.raw)
    ).run();

    return c.json({ success: true, message: '激活码已作废' });
  } catch (error) {
    console.error('Revoke code error:', error);
    return c.json({ success: false, error: '作废激活码失败' }, 500);
  }
});

// 删除激活码 (软删除)
codes.delete('/:id', async (c) => {
  try {
    const adminId = c.get('adminId');
    const id = c.req.param('id');

    const code = await c.env.DB.prepare(
      'SELECT * FROM activation_codes WHERE id = ? AND admin_id = ? AND deleted_at IS NULL'
    ).bind(id, adminId).first<ActivationCode>();

    if (!code) {
      return c.json({ success: false, error: '激活码不存在' }, 404);
    }

    await c.env.DB.prepare(
      `UPDATE activation_codes SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
    ).bind(id).run();

    // 记录操作日志
    await c.env.DB.prepare(
      `INSERT INTO operation_logs (id, admin_id, action, target_type, target_id, details, ip, created_at)
       VALUES (?, ?, 'delete_code', 'activation_code', ?, ?, ?, datetime('now'))`
    ).bind(
      generateUUID(),
      adminId,
      id,
      JSON.stringify({ code: code.code }),
      getClientIp(c.req.raw)
    ).run();

    return c.json({ success: true, message: '激活码已删除' });
  } catch (error) {
    console.error('Delete code error:', error);
    return c.json({ success: false, error: '删除激活码失败' }, 500);
  }
});

// 导出激活码 (返回 CSV 格式数据)
codes.get('/export/csv', async (c) => {
  try {
    const adminId = c.get('adminId');
    const status = c.req.query('status');
    const app_name = c.req.query('app_name');

    let whereClause = 'admin_id = ? AND deleted_at IS NULL';
    const params: any[] = [adminId];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    if (app_name) {
      whereClause += ' AND app_name = ?';
      params.push(app_name);
    }

    const result = await c.env.DB.prepare(
      `SELECT code, app_name, user_name, status, duration_hours, activated_at, expired_at, request_count, remark, created_at
       FROM activation_codes WHERE ${whereClause} ORDER BY created_at DESC`
    ).bind(...params).all<ActivationCode>();

    const codes = result.results || [];

    // 生成 CSV
    const headers = ['激活码', 'APP名称', '用户名称', '状态', '有效时长(小时)', '激活时间', '过期时间', '请求次数', '备注', '创建时间'];
    const rows = codes.map((code) => [
      code.code,
      code.app_name,
      code.user_name,
      code.status,
      code.duration_hours,
      code.activated_at || '',
      code.expired_at || '',
      code.request_count,
      code.remark || '',
      code.created_at,
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');

    // 记录操作日志
    await c.env.DB.prepare(
      `INSERT INTO operation_logs (id, admin_id, action, target_type, target_id, details, ip, created_at)
       VALUES (?, ?, 'export_codes', 'activation_code', NULL, ?, ?, datetime('now'))`
    ).bind(
      generateUUID(),
      adminId,
      JSON.stringify({ count: codes.length, filters: { status, app_name } }),
      getClientIp(c.req.raw)
    ).run();

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="activation_codes_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export codes error:', error);
    return c.json({ success: false, error: '导出激活码失败' }, 500);
  }
});

export default codes;

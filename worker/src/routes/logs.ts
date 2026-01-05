import { Hono } from 'hono';
import { Env, OperationLog } from '../types';

const logs = new Hono<{ Bindings: Env }>();

// 日志列表
logs.get('/', async (c) => {
  try {
    const adminId = c.get('adminId');
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const action = c.req.query('action');
    const start_date = c.req.query('start_date');
    const end_date = c.req.query('end_date');

    let whereClause = 'admin_id = ?';
    const params: any[] = [adminId];

    if (action) {
      whereClause += ' AND action = ?';
      params.push(action);
    }
    if (start_date) {
      whereClause += ' AND created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND created_at <= ?';
      params.push(end_date + ' 23:59:59');
    }

    // 只查询最近 3 个月的日志
    whereClause += " AND created_at >= datetime('now', '-3 months')";

    // 获取总数
    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM operation_logs WHERE ${whereClause}`
    ).bind(...params).first<{ total: number }>();

    const total = countResult?.total || 0;

    // 获取列表
    const offset = (page - 1) * pageSize;
    const listResult = await c.env.DB.prepare(
      `SELECT * FROM operation_logs WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, pageSize, offset).all<OperationLog>();

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
    console.error('Get logs error:', error);
    return c.json({ success: false, error: '获取操作日志失败' }, 500);
  }
});

export default logs;

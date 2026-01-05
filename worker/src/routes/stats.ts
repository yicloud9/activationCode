import { Hono } from 'hono';
import { Env } from '../types';

const stats = new Hono<{ Bindings: Env }>();

// 按 APP 统计
stats.get('/by-app', async (c) => {
  try {
    const adminId = c.get('adminId');

    const result = await c.env.DB.prepare(
      `SELECT
        app_name,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'activated' THEN 1 ELSE 0 END) as activated,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
        SUM(CASE WHEN status = 'revoked' THEN 1 ELSE 0 END) as revoked
       FROM activation_codes
       WHERE admin_id = ? AND deleted_at IS NULL
       GROUP BY app_name
       ORDER BY total DESC`
    ).bind(adminId).all();

    return c.json({
      success: true,
      data: result.results || [],
    });
  } catch (error) {
    console.error('Stats by app error:', error);
    return c.json({ success: false, error: '获取统计数据失败' }, 500);
  }
});

// 按时间段统计
stats.get('/by-time', async (c) => {
  try {
    const adminId = c.get('adminId');
    const period = c.req.query('period') || 'day'; // day, week, month
    const days = c.req.query('days') || '30'; // 最近多少天

    let dateFormat: string;
    switch (period) {
      case 'week':
        dateFormat = '%Y-W%W';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
      default:
        dateFormat = '%Y-%m-%d';
    }

    const result = await c.env.DB.prepare(
      `SELECT
        strftime('${dateFormat}', created_at) as period,
        COUNT(*) as generated,
        SUM(CASE WHEN status = 'activated' THEN 1 ELSE 0 END) as activated
       FROM activation_codes
       WHERE admin_id = ?
         AND deleted_at IS NULL
         AND created_at >= datetime('now', '-${parseInt(days)} days')
       GROUP BY strftime('${dateFormat}', created_at)
       ORDER BY period ASC`
    ).bind(adminId).all();

    return c.json({
      success: true,
      data: result.results || [],
    });
  } catch (error) {
    console.error('Stats by time error:', error);
    return c.json({ success: false, error: '获取统计数据失败' }, 500);
  }
});

// 按状态统计
stats.get('/by-status', async (c) => {
  try {
    const adminId = c.get('adminId');

    const result = await c.env.DB.prepare(
      `SELECT
        status,
        COUNT(*) as count
       FROM activation_codes
       WHERE admin_id = ? AND deleted_at IS NULL
       GROUP BY status`
    ).bind(adminId).all();

    const stats: Record<string, number> = {
      pending: 0,
      activated: 0,
      expired: 0,
      revoked: 0,
      total: 0,
    };

    for (const row of result.results as any[] || []) {
      stats[row.status] = row.count;
      stats.total += row.count;
    }

    return c.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Stats by status error:', error);
    return c.json({ success: false, error: '获取统计数据失败' }, 500);
  }
});

export default stats;

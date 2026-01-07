import { Hono } from 'hono';
import { Env, Admin, ActivationCode } from '../types';
import { hmacSha256 } from '../utils/crypto';

const verify = new Hono<{ Bindings: Env }>();

// 验证激活码
verify.post('/verify', async (c) => {
  try {
    const { code, app_name, user_name, timestamp, nonce, signature, api_key } = await c.req.json();

    // 参数验证
    if (!code || !app_name || !user_name || !timestamp || !nonce || !signature || !api_key) {
      return c.json({ success: false, error: '缺少必要参数' }, 400);
    }

    // 根据 api_key 查找管理员获取 api_secret
    const admin = await c.env.DB.prepare(
      'SELECT api_secret FROM admins WHERE api_key = ?'
    ).bind(api_key).first<Pick<Admin, 'api_secret'>>();

    if (!admin) {
      return c.json({ success: false, error: 'API Key 无效' }, 401);
    }

    // 验证时间戳 (允许 ±5 分钟误差)
    const now = Date.now();
    const requestTime = parseInt(timestamp);
    const timeDiff = Math.abs(now - requestTime);
    if (timeDiff > 5 * 60 * 1000) {
      return c.json({ success: false, error: '请求已过期' }, 400);
    }

    // 验证签名
    const signatureInput = `${code}${app_name}${user_name}${timestamp}${nonce}${admin.api_secret}`;
    const expectedSignature = await hmacSha256(signatureInput, admin.api_secret);

    if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
      return c.json({ success: false, error: '签名验证失败' }, 401);
    }

    // 验证 nonce (防重放)
    const nonceKey = `nonce:${nonce}`;
    const existingNonce = await c.env.NONCE_KV.get(nonceKey);
    if (existingNonce) {
      return c.json({ success: false, error: '请求已被使用' }, 400);
    }

    // 存储 nonce，5 分钟过期
    await c.env.NONCE_KV.put(nonceKey, '1', { expirationTtl: 300 });

    // 查询激活码
    const activationCode = await c.env.DB.prepare(
      'SELECT * FROM activation_codes WHERE code = ? AND deleted_at IS NULL'
    ).bind(code).first<ActivationCode>();

    if (!activationCode) {
      return c.json({ success: true, valid: false, message: '激活码不存在' });
    }

    // 验证 APP 名称是否匹配
    if (activationCode.app_name !== app_name) {
      return c.json({ success: true, valid: false, message: '激活码与 APP 不匹配' });
    }

    // 验证用户名称是否匹配
    if (activationCode.user_name !== user_name) {
      return c.json({ success: true, valid: false, message: '激活码与用户不匹配' });
    }

    // 检查状态
    if (activationCode.status === 'revoked') {
      return c.json({ success: true, valid: false, message: '激活码已作废' });
    }

    if (activationCode.status === 'expired') {
      return c.json({ success: true, valid: false, message: '激活码已过期' });
    }

    const now_iso = new Date().toISOString().replace('T', ' ').slice(0, 19);

    // 处理激活逻辑
    if (activationCode.status === 'pending') {
      // 首次激活
      const expiredAt = new Date(Date.now() + activationCode.duration_hours * 60 * 60 * 1000)
        .toISOString().replace('T', ' ').slice(0, 19);

      await c.env.DB.prepare(
        `UPDATE activation_codes
         SET status = 'activated',
             activated_at = ?,
             expired_at = ?,
             request_count = request_count + 1,
             updated_at = ?
         WHERE id = ?`
      ).bind(now_iso, expiredAt, now_iso, activationCode.id).run();

      return c.json({
        success: true,
        valid: true,
        message: '激活码已激活',
        data: {
          activated_at: now_iso,
          expired_at: expiredAt,
        },
      });
    }

    if (activationCode.status === 'activated') {
      // 检查是否过期
      if (activationCode.expired_at && new Date(activationCode.expired_at) < new Date()) {
        await c.env.DB.prepare(
          `UPDATE activation_codes SET status = 'expired', updated_at = ? WHERE id = ?`
        ).bind(now_iso, activationCode.id).run();

        return c.json({ success: true, valid: false, message: '激活码已过期' });
      }

      // 更新请求次数
      await c.env.DB.prepare(
        `UPDATE activation_codes SET request_count = request_count + 1, updated_at = ? WHERE id = ?`
      ).bind(now_iso, activationCode.id).run();

      return c.json({
        success: true,
        valid: true,
        message: '激活码有效',
        data: {
          activated_at: activationCode.activated_at,
          expired_at: activationCode.expired_at,
        },
      });
    }

    return c.json({ success: true, valid: false, message: '激活码状态异常' });
  } catch (error) {
    console.error('Verify error:', error);
    return c.json({ success: false, error: '验证失败' }, 500);
  }
});

export default verify;

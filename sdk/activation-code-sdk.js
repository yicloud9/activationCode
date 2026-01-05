/**
 * 激活码验证 SDK
 * 纯 JavaScript 实现，无需第三方依赖
 */

class ActivationCodeSDK {
  constructor(apiUrl, apiKey, apiSecret) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  /**
   * 生成随机字符串 (nonce)
   */
  generateNonce(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => chars[byte % chars.length]).join('');
  }

  /**
   * HMAC-SHA256 签名 (使用 Web Crypto API)
   */
  async hmacSha256(message, secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(message)
    );

    // 转换为十六进制字符串
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * 验证激活码
   * @param {string} code - 6位激活码
   * @param {string} appName - APP名称
   * @returns {Promise<{success: boolean, valid?: boolean, message: string}>}
   */
  async verify(code, appName) {
    const timestamp = Date.now().toString();
    const nonce = this.generateNonce();

    // 生成签名: code + app_name + timestamp + nonce + api_secret
    const signatureInput = `${code}${appName}${timestamp}${nonce}${this.apiSecret}`;
    const signature = await this.hmacSha256(signatureInput, this.apiSecret);

    const response = await fetch(`${this.apiUrl}/api/v1/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        app_name: appName,
        timestamp,
        nonce,
        signature,
        api_key: this.apiKey,
      }),
    });

    return response.json();
  }
}

// ==================== 使用示例 ====================

/*
// 初始化 SDK
const sdk = new ActivationCodeSDK(
  'https://activation-code-api.zx524733157.workers.dev',  // API 地址
  'ak_xxxxx',  // 从管理后台获取的 API Key
  'as_xxxxx'   // 从管理后台获取的 API Secret
);

// 验证激活码
async function checkActivation() {
  try {
    const result = await sdk.verify('AbCdEf', 'MyApp');

    if (result.success && result.valid) {
      console.log('激活码有效！');
      console.log('过期时间:', result.data.expired_at);
    } else {
      console.log('激活码无效:', result.message);
    }
  } catch (error) {
    console.error('验证失败:', error);
  }
}

checkActivation();
*/

// Node.js 环境导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ActivationCodeSDK;
}

// 浏览器环境挂载到 window
if (typeof window !== 'undefined') {
  window.ActivationCodeSDK = ActivationCodeSDK;
}

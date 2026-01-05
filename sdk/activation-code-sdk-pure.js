/**
 * 激活码验证 SDK
 * 纯 JavaScript 实现，无任何依赖，适用于任何 JS 运行环境
 */

// ==================== SHA256 纯 JS 实现 ====================

function sha256(message) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  // 转换为字节数组
  const bytes = [];
  for (let i = 0; i < message.length; i++) {
    const code = message.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }

  // 填充
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) {
    bytes.push(0);
  }

  // 添加长度 (64位大端)
  for (let i = 7; i >= 0; i--) {
    bytes.push((bitLength / Math.pow(2, i * 8)) & 0xff);
  }

  // 初始哈希值
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  // 处理每个 512 位块
  for (let i = 0; i < bytes.length; i += 64) {
    const w = [];
    for (let j = 0; j < 16; j++) {
      w[j] = (bytes[i + j * 4] << 24) | (bytes[i + j * 4 + 1] << 16) | (bytes[i + j * 4 + 2] << 8) | bytes[i + j * 4 + 3];
    }
    for (let j = 16; j < 64; j++) {
      const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let j = 0; j < 64; j++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[j] + w[j]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  // 输出为字节数组
  const hash = [];
  [h0, h1, h2, h3, h4, h5, h6, h7].forEach(h => {
    hash.push((h >> 24) & 0xff, (h >> 16) & 0xff, (h >> 8) & 0xff, h & 0xff);
  });
  return hash;
}

// ==================== HMAC-SHA256 实现 ====================

function hmacSha256(message, key) {
  const blockSize = 64;

  // 转换 key 为字节数组
  let keyBytes = [];
  for (let i = 0; i < key.length; i++) {
    keyBytes.push(key.charCodeAt(i));
  }

  // 如果 key 太长，先 hash
  if (keyBytes.length > blockSize) {
    keyBytes = sha256(key);
  }

  // 填充到 blockSize
  while (keyBytes.length < blockSize) {
    keyBytes.push(0);
  }

  // 生成 ipad 和 opad
  const ipad = keyBytes.map(b => b ^ 0x36);
  const opad = keyBytes.map(b => b ^ 0x5c);

  // 内层 hash: SHA256(ipad + message)
  const innerMessage = String.fromCharCode(...ipad) + message;
  const innerHash = sha256(innerMessage);

  // 外层 hash: SHA256(opad + innerHash)
  const outerMessage = String.fromCharCode(...opad) + String.fromCharCode(...innerHash);
  const outerHash = sha256(outerMessage);

  // 转换为十六进制字符串
  return outerHash.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ==================== 激活码 SDK ====================

function generateNonce(length) {
  length = length || 16;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 验证激活码
 * @param {Object} config - 配置
 * @param {string} config.apiUrl - API 地址
 * @param {string} config.apiKey - API Key
 * @param {string} config.apiSecret - API Secret
 * @param {string} config.code - 激活码
 * @param {string} config.appName - APP 名称
 * @param {function} config.httpPost - HTTP POST 函数 (url, body) => Promise<response>
 * @returns {Promise<Object>}
 */
function verifyActivationCode(config) {
  var timestamp = Date.now().toString();
  var nonce = generateNonce(16);

  // 生成签名
  var signatureInput = config.code + config.appName + timestamp + nonce + config.apiSecret;
  var signature = hmacSha256(signatureInput, config.apiSecret);

  var body = {
    code: config.code,
    app_name: config.appName,
    timestamp: timestamp,
    nonce: nonce,
    signature: signature,
    api_key: config.apiKey
  };

  return config.httpPost(config.apiUrl + '/api/v1/verify', body);
}

// ==================== 使用示例 ====================

/*
// 示例：使用自定义的 HTTP 函数
verifyActivationCode({
  apiUrl: 'https://activation-code-api.zx524733157.workers.dev',
  apiKey: 'ak_xxxxx',
  apiSecret: 'as_xxxxx',
  code: 'AbCdEf',
  appName: 'MyApp',
  httpPost: function(url, body) {
    // 根据你的运行环境实现 HTTP POST
    // 返回 Promise 或直接返回结果
    return yourHttpClient.post(url, body);
  }
}).then(function(result) {
  if (result.success && result.valid) {
    console.log('激活码有效');
  } else {
    console.log('激活码无效:', result.message);
  }
});

// 如果环境不支持 Promise，可以直接获取签名参数自行发送请求：
var timestamp = Date.now().toString();
var nonce = generateNonce(16);
var signatureInput = code + appName + timestamp + nonce + apiSecret;
var signature = hmacSha256(signatureInput, apiSecret);
// 然后用你的方式发送 POST 请求
*/

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sha256: sha256,
    hmacSha256: hmacSha256,
    generateNonce: generateNonce,
    verifyActivationCode: verifyActivationCode
  };
}

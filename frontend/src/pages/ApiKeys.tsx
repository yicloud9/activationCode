import { useEffect, useState } from 'react';
import { apiKeysApi } from '../services/api';

export default function ApiKeys() {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      const response = await apiKeysApi.get();
      if (response.data.success) {
        setApiKey(response.data.data.api_key);
        setApiSecret(response.data.data.api_secret);
      }
    } catch (error) {
      console.error('Load keys error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!confirm('确定要重新生成 API Secret 吗？旧的 Secret 将立即失效。')) return;

    setRegenerating(true);
    try {
      const response = await apiKeysApi.regenerate();
      if (response.data.success) {
        setApiSecret(response.data.data.api_secret);
        setShowSecret(true);
        alert('API Secret 已重新生成');
      }
    } catch (error) {
      console.error('Regenerate error:', error);
    } finally {
      setRegenerating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`${label} 已复制到剪贴板`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">API 密钥</h1>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 space-y-6">
          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Key
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={apiKey}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
              />
              <button
                onClick={() => copyToClipboard(apiKey, 'API Key')}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                复制
              </button>
            </div>
          </div>

          {/* API Secret */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Secret
            </label>
            <div className="flex gap-2">
              <input
                type={showSecret ? 'text' : 'password'}
                value={apiSecret}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
              />
              <button
                onClick={() => setShowSecret(!showSecret)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {showSecret ? '隐藏' : '显示'}
              </button>
              <button
                onClick={() => copyToClipboard(apiSecret, 'API Secret')}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                复制
              </button>
            </div>
          </div>

          {/* 重新生成 */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {regenerating ? '生成中...' : '重新生成 API Secret'}
            </button>
            <p className="mt-2 text-sm text-gray-500">
              重新生成后，旧的 API Secret 将立即失效，请及时更新您的应用配置。
            </p>
          </div>
        </div>
      </div>

      {/* 使用说明 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">API 使用说明</h2>
        </div>
        <div className="p-6">
          <h3 className="font-medium text-gray-800 mb-2">验证接口</h3>
          <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto">
{`POST /api/v1/verify
Content-Type: application/json

{
  "code": "AbCdEf",
  "app_name": "MyApp",
  "timestamp": 1234567890123,
  "nonce": "random_string",
  "signature": "hmac_sha256_signature",
  "api_key": "your_api_key"
}`}
          </pre>

          <h3 className="font-medium text-gray-800 mt-6 mb-2">签名算法</h3>
          <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto">
{`待签名字符串 = code + app_name + timestamp + nonce + api_secret
signature = HMAC-SHA256(待签名字符串, api_secret)`}
          </pre>

          <h3 className="font-medium text-gray-800 mt-6 mb-2">响应示例</h3>
          <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto">
{`// 成功
{
  "success": true,
  "valid": true,
  "message": "激活码有效"
}

// 失败
{
  "success": true,
  "valid": false,
  "message": "激活码已过期"
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}

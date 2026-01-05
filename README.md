# 激活码管理系统

基于 Cloudflare 技术栈的激活码管理系统，用于控制 APP 的使用权限。

## 技术栈

- **前端**: React + TypeScript + Tailwind CSS (Cloudflare Pages)
- **后端**: Cloudflare Workers + Hono
- **数据库**: Cloudflare D1 (SQLite)
- **缓存**: Cloudflare KV (用于 nonce 防重放)

## 项目结构

```
ActivationCode/
├── frontend/          # React 前端应用
│   ├── src/
│   ├── package.json
│   └── ...
├── worker/            # Cloudflare Workers 后端
│   ├── src/
│   ├── schema.sql     # 数据库结构
│   ├── wrangler.toml
│   └── package.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
# 后端
cd worker && npm install

# 前端
cd ../frontend && npm install
```

### 2. 创建 Cloudflare 资源

```bash
cd worker

# 登录 Cloudflare
npx wrangler login

# 创建 D1 数据库
npx wrangler d1 create activation-code-db

# 创建 KV 命名空间
npx wrangler kv:namespace create NONCE_KV
```

将输出的 ID 更新到 `worker/wrangler.toml`。

### 3. 初始化数据库

```bash
cd worker
npx wrangler d1 execute activation-code-db --remote --file=./schema.sql
```

### 4. 配置环境变量

在 Cloudflare Dashboard 中为 Worker 添加环境变量：

| 变量名 | 说明 |
|--------|------|
| `JWT_SECRET` | JWT 签名密钥（使用强随机字符串） |

### 5. 部署后端

```bash
cd worker
npm run deploy
```

记录输出的 Worker URL。

### 6. 部署前端

```bash
cd frontend

# 设置 API 地址
echo "VITE_API_URL=https://your-worker.workers.dev" > .env.production

# 构建并部署
npm run build
npx wrangler pages deploy dist --project-name=activation-code-admin
```

### 7. 初始化系统

访问 `https://activation-code-admin.pages.dev/init` 创建管理员账号。

## 本地开发

```bash
# 终端 1: 启动后端
cd worker
npm run dev  # 监听 localhost:8787

# 终端 2: 启动前端
cd frontend
npm run dev  # 监听 localhost:3000，自动代理到后端
```

## API 接口

### 消费端 - 验证激活码

```http
POST /api/v1/verify
Content-Type: application/json

{
  "code": "AbCdEf",
  "app_name": "MyApp",
  "timestamp": 1704067200000,
  "nonce": "random_string",
  "signature": "hmac_sha256_signature",
  "api_key": "ak_xxx"
}
```

**签名算法:**
```
signature = HMAC-SHA256(code + app_name + timestamp + nonce + api_secret, api_secret)
```

**响应:**
```json
{
  "success": true,
  "valid": true,
  "message": "激活码有效",
  "data": {
    "activated_at": "2024-01-01 00:00:00",
    "expired_at": "2024-01-02 00:00:00"
  }
}
```

### 管理端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /admin/init | 初始化管理员（仅首次） |
| POST | /admin/login | 登录 |
| POST | /admin/logout | 登出 |
| PUT | /admin/password | 修改密码 |
| GET | /admin/api-keys | 获取 API 密钥 |
| POST | /admin/api-keys/regenerate | 重新生成密钥 |
| POST | /admin/codes | 生成激活码 |
| GET | /admin/codes | 激活码列表 |
| PUT | /admin/codes/:id/revoke | 作废激活码 |
| DELETE | /admin/codes/:id | 删除激活码 |
| GET | /admin/codes/export/csv | 导出 CSV |
| GET | /admin/stats/by-app | 按 APP 统计 |
| GET | /admin/stats/by-time | 按时间统计 |
| GET | /admin/stats/by-status | 按状态统计 |
| GET | /admin/logs | 操作日志 |

## 激活码状态流转

```
pending (待激活)
    │
    │ 首次验证
    ▼
activated (已激活) ───► expired (已过期)
    │                     到期自动转换
    │
    │ 手动作废
    ▼
revoked (已作废)
```

## 安全特性

- 密码使用 PBKDF2-SHA256 哈希存储
- JWT Token 24 小时有效期
- API 请求签名验证 (HMAC-SHA256)
- 时间戳校验（±5 分钟误差）
- Nonce 防重放攻击（5 分钟内拒绝重复）
- 数据隔离（管理员只能操作自己的数据）
- 操作审计日志

## 许可证

MIT

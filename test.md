激活码系统迁移方案：Cloudflare → Ubuntu 服务器 (Docker)

 技术栈

 - 后端: Node.js 20 + Hono + better-sqlite3 + ioredis
 - 数据库: SQLite
 - 缓存: Redis (替代 Cloudflare KV)
 - 前端: React (静态文件)
 - 部署: Docker Compose + Nginx

 ---
 实施步骤

 第一步：创建适配层代码

 1.1 新增文件 worker/src/db/index.ts - SQLite 封装

 import Database from 'better-sqlite3';

 const db = new Database(process.env.DATABASE_PATH || './data/activation.db');
 db.pragma('journal_mode = WAL');

 // 适配 D1 API
 export const createDB = () => ({
   prepare: (sql: string) => ({
     bind: (...params: any[]) => ({
       run: () => db.prepare(sql).run(...params),
       first: <T>() => db.prepare(sql).get(...params) as T,
       all: <T>() => ({ results: db.prepare(sql).all(...params) as T[] }),
     }),
     run: () => db.prepare(sql).run(),
     first: <T>() => db.prepare(sql).get() as T,
     all: <T>() => ({ results: db.prepare(sql).all() as T[] }),
   }),
 });

 1.2 新增文件 worker/src/cache/index.ts - Redis 封装

 import Redis from 'ioredis';

 const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

 // 适配 KV API
 export const createKV = () => ({
   get: async (key: string) => await redis.get(key),
   put: async (key: string, value: string, options?: { expirationTtl?: number }) => {
     if (options?.expirationTtl) {
       await redis.setex(key, options.expirationTtl, value);
     } else {
       await redis.set(key, value);
     }
   },
 });

 1.3 新增文件 worker/src/env.ts - 环境适配

 import { createDB } from './db';
 import { createKV } from './cache';

 export const createEnv = () => ({
   DB: createDB(),
   NONCE_KV: createKV(),
   JWT_SECRET: process.env.JWT_SECRET || 'change-this-secret',
   CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
 });

 1.4 新增文件 worker/server.ts - Node.js 入口

 import 'dotenv/config';
 import { serve } from '@hono/node-server';
 import { createEnv } from './src/env';
 import app from './src/index';

 // 注入环境变量到 Hono context
 const env = createEnv();
 const enhancedApp = app;
 enhancedApp.use('*', async (c, next) => {
   c.env = env as any;
   await next();
 });

 serve({ fetch: enhancedApp.fetch, port: parseInt(process.env.PORT || '3000') }, (info) => {
   console.log(`Server running on http://localhost:${info.port}`);
 });

 第二步：修改现有代码

 2.1 修改 worker/src/types.ts

 // 添加 Node.js 兼容类型
 export interface Env {
   DB: {
     prepare: (sql: string) => PreparedStatement;
   };
   NONCE_KV: {
     get: (key: string) => Promise<string | null>;
     put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
   };
   JWT_SECRET: string;
   CORS_ORIGIN: string;
 }

 2.2 修改 worker/src/utils/crypto.ts

 在文件顶部添加 Node.js crypto polyfill：
 import { webcrypto } from 'node:crypto';
 if (typeof globalThis.crypto === 'undefined') {
   (globalThis as any).crypto = webcrypto;
 }

 2.3 修改 worker/package.json

 {
   "name": "activation-code-server",
   "version": "1.0.0",
   "type": "module",
   "scripts": {
     "dev": "tsx watch server.ts",
     "build": "tsc",
     "start": "node dist/server.js",
     "db:init": "sqlite3 ./data/activation.db < schema.sql"
   },
   "dependencies": {
     "hono": "^4.3.0",
     "@hono/node-server": "^1.8.0",
     "better-sqlite3": "^11.0.0",
     "ioredis": "^5.3.0",
     "dotenv": "^16.4.0"
   },
   "devDependencies": {
     "@types/better-sqlite3": "^7.6.8",
     "@types/node": "^20.11.0",
     "tsx": "^4.7.0",
     "typescript": "^5.4.0"
   }
 }

 第三步：Docker 配置

 3.1 新增 worker/Dockerfile

 FROM node:20-alpine

 # 安装 SQLite 编译依赖
 RUN apk add --no-cache python3 make g++ sqlite

 WORKDIR /app

 COPY package*.json ./
 RUN npm ci --only=production

 COPY . .

 # 创建数据目录
 RUN mkdir -p /app/data

 EXPOSE 3000

 CMD ["node", "server.js"]

 3.2 新增 docker-compose.yml (项目根目录)

 version: '3.8'

 services:
   backend:
     build: ./worker
     restart: unless-stopped
     ports:
       - "3000:3000"
     environment:
       - NODE_ENV=production
       - PORT=3000
       - JWT_SECRET=${JWT_SECRET}
       - CORS_ORIGIN=${CORS_ORIGIN}
       - DATABASE_PATH=/app/data/activation.db
       - REDIS_URL=redis://redis:6379
     volumes:
       - sqlite-data:/app/data
     depends_on:
       - redis

   redis:
     image: redis:7-alpine
     restart: unless-stopped
     volumes:
       - redis-data:/data

   nginx:
     image: nginx:alpine
     restart: unless-stopped
     ports:
       - "80:80"
       - "443:443"
     volumes:
       - ./frontend/dist:/usr/share/nginx/html:ro
       - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
       - ./certbot/conf:/etc/letsencrypt:ro
     depends_on:
       - backend

 volumes:
   sqlite-data:
   redis-data:

 3.3 新增 nginx.conf (项目根目录)

 server {
     listen 80;
     server_name _;

     # 前端静态文件
     location / {
         root /usr/share/nginx/html;
         try_files $uri $uri/ /index.html;
     }

     # 后端 API
     location /admin {
         proxy_pass http://backend:3000;
         proxy_http_version 1.1;
         proxy_set_header Host $host;
         proxy_set_header X-Real-IP $remote_addr;
         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
         proxy_set_header X-Forwarded-Proto $scheme;
     }

     location /api {
         proxy_pass http://backend:3000;
         proxy_http_version 1.1;
         proxy_set_header Host $host;
         proxy_set_header X-Real-IP $remote_addr;
         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
     }

     location /health {
         proxy_pass http://backend:3000;
     }
 }

 3.4 新增 .env.example (项目根目录)

 JWT_SECRET=your-secure-jwt-secret-at-least-32-chars
 CORS_ORIGIN=https://your-domain.com

 第四步：修改前端配置

 4.1 修改 frontend/src/services/api.ts

 将 baseURL 改为相对路径（已兼容 Nginx 代理）：
 const api = axios.create({
   baseURL: '', // 使用相对路径，Nginx 会代理
   timeout: 10000,
 });

 ---
 部署流程

 本地构建

 # 1. 构建前端
 cd frontend
 npm install
 npm run build

 # 2. 返回项目根目录
 cd ..

 服务器部署

 # 1. 安装 Docker
 curl -fsSL https://get.docker.com | sh
 sudo usermod -aG docker $USER

 # 2. 上传项目文件
 scp -r . user@server:/opt/activation-code/

 # 3. 配置环境变量
 cd /opt/activation-code
 cp .env.example .env
 nano .env  # 修改 JWT_SECRET

 # 4. 初始化数据库
 docker compose run --rm backend sh -c "sqlite3 /app/data/activation.db < /app/schema.sql"

 # 5. 启动服务
 docker compose up -d

 # 6. 查看日志
 docker compose logs -f

 HTTPS 配置（可选）

 # 使用 Certbot 获取证书
 docker run -it --rm \
   -v ./certbot/conf:/etc/letsencrypt \
   -v ./frontend/dist:/var/www/html \
   certbot/certbot certonly --webroot \
   -w /var/www/html -d your-domain.com

 ---
 需要修改/新增的文件清单

 | 文件                         | 操作 | 说明                  |
 |------------------------------|------|-----------------------|
 | worker/server.ts             | 新增 | Node.js 入口          |
 | worker/src/env.ts            | 新增 | 环境适配层            |
 | worker/src/db/index.ts       | 新增 | SQLite 封装           |
 | worker/src/cache/index.ts    | 新增 | Redis 封装            |
 | worker/src/types.ts          | 修改 | 类型兼容              |
 | worker/src/utils/crypto.ts   | 修改 | 添加 Node.js polyfill |
 | worker/package.json          | 修改 | 添加依赖              |
 | worker/tsconfig.json         | 修改 | Node.js 配置          |
 | worker/Dockerfile            | 新增 | Docker 构建           |
 | docker-compose.yml           | 新增 | 容器编排              |
 | nginx.conf                   | 新增 | Nginx 配置            |
 | .env.example                 | 新增 | 环境变量模板          |
 | frontend/src/services/api.ts | 修改 | baseURL 改为相对路径  |

 ---
 架构对比

 | 组件       | Cloudflare     | Ubuntu Docker        |
 |------------|----------------|----------------------|
 | 后端运行时 | Workers Edge   | Node.js 容器         |
 | 数据库     | D1 (SQLite)    | SQLite 文件 + 持久卷 |
 | KV 存储    | Cloudflare KV  | Redis 容器           |
 | 前端       | Pages          | Nginx 静态服务       |
 | 反向代理   | Cloudflare CDN | Nginx                |
 | SSL        | 自动           | Certbot/自签         |
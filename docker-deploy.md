# Docker 部署指南

## 系统架构

```
                    ┌─────────────────────────────────────────┐
                    │              Docker Network             │
                    │                                         │
  用户请求 ──────▶  │  ┌─────────┐    ┌─────────┐    ┌─────┐  │
       :80          │  │  Nginx  │───▶│ Backend │───▶│Redis│  │
                    │  └─────────┘    └─────────┘    └─────┘  │
                    │       │              │                  │
                    │       ▼              ▼                  │
                    │  前端静态文件    SQLite 数据库           │
                    └─────────────────────────────────────────┘
```

**服务组件：**

| 服务 | 说明 | 端口 |
|------|------|------|
| nginx | 反向代理，托管前端静态文件 | 80 |
| backend | Node.js 后台 API 服务 | 3000 (内部) |
| redis | 缓存服务（限流、会话等） | 6379 (内部) |

---

## 环境要求

- Linux 服务器 (推荐 Ubuntu 20.04+)
- Git
- Node.js 18+ (用于构建前端)
- Docker 20.10+
- Docker Compose v2+
- 至少 1GB 内存
- 开放端口：80

---

## 首次部署

### 1. 服务器初始化

```bash
# SSH 登录到服务器
ssh user@your-server-ip

# 安装 Git（如未安装）
sudo apt update && sudo apt install -y git

# 安装 Node.js 18+（如未安装）
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 Docker（如未安装）
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 重新登录使 docker 组生效
exit
```

### 2. 克隆代码

```bash
# 重新 SSH 登录
ssh user@your-server-ip

# 克隆仓库
cd /opt
git clone https://github.com/your-username/activation-code.git
cd activation-code

# 如果是私有仓库，使用 SSH 方式
# git clone git@github.com:your-username/activation-code.git
```

### 3. 构建前端

```bash
cd /opt/activation-code/frontend
npm install
npm run build
cd ..
```

### 4. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
nano .env
```

**.env 配置说明：**

```bash
# [必须修改] JWT 密钥，用于管理后台认证
# 生成方式: openssl rand -base64 32
JWT_SECRET=your-secure-random-string-at-least-32-chars

# CORS 允许的源（通过 IP 访问时保持 * 即可）
CORS_ORIGIN=*
```

### 5. 启动服务

```bash
# 构建并启动所有服务
docker compose up -d --build

# 查看服务状态
docker compose ps
```

正常输出：
```
NAME                      STATUS
activation-code-backend   Up
activation-code-redis     Up
activation-code-nginx     Up
```

### 6. 初始化数据库

```bash
# 执行 SQL 初始化
docker compose exec backend sh -c "sqlite3 /app/data/activation.db < /app/schema.sql"

# 验证数据库创建成功
docker compose exec backend sqlite3 /app/data/activation.db ".tables"
```

### 7. 验证部署

```bash
# 健康检查
curl http://localhost/health

# 预期返回
{"status":"ok","timestamp":"..."}
```

访问地址（将 `your-server-ip` 替换为实际 IP）：
- 前端管理界面：`http://your-server-ip/`
- API 接口：`http://your-server-ip/api/v1/verify`
- 健康检查：`http://your-server-ip/health`

---

## 更新升级

```bash
cd /opt/activation-code

# 拉取最新代码
git pull origin main

# 重新构建前端
cd frontend && npm install && npm run build && cd ..

# 重新构建并启动服务
docker compose up -d --build

# 验证
curl http://localhost/health
```

### 快速更新脚本

创建 `/opt/activation-code/update.sh`：

```bash
#!/bin/bash
set -e
cd /opt/activation-code

echo ">>> 拉取最新代码..."
git pull origin main

echo ">>> 构建前端..."
cd frontend && npm install && npm run build && cd ..

echo ">>> 重启服务..."
docker compose up -d --build

sleep 5
echo ">>> 健康检查..."
curl -s http://localhost/health
echo -e "\n>>> 更新完成！"
```

```bash
chmod +x /opt/activation-code/update.sh
```

---

## 运维管理

### 查看日志

```bash
# 所有服务日志
docker compose logs -f

# 特定服务
docker compose logs -f backend

# 最近 100 行
docker compose logs --tail=100 backend
```

### 服务管理

```bash
# 停止服务
docker compose down

# 重启服务
docker compose restart

# 重启单个服务
docker compose restart backend
```

### 数据备份

```bash
# 创建备份目录
mkdir -p /opt/activation-code/backups

# 备份数据库
docker run --rm -v activation-code_sqlite-data:/data -v /opt/activation-code/backups:/backup \
  alpine cp /data/activation.db /backup/activation-$(date +%Y%m%d).db
```

### 数据恢复

```bash
docker compose down

docker run --rm -v activation-code_sqlite-data:/data -v /opt/activation-code/backups:/backup \
  alpine cp /backup/activation-20240101.db /data/activation.db

docker compose up -d
```

### 自动备份

```bash
crontab -e

# 每天凌晨 2 点备份，保留 30 天
0 2 * * * docker run --rm -v activation-code_sqlite-data:/data -v /opt/activation-code/backups:/backup alpine cp /data/activation.db /backup/activation-$(date +\%Y\%m\%d).db
0 3 * * * find /opt/activation-code/backups -name "*.db" -mtime +30 -delete
```

---

## 故障排查

**服务启动失败**
```bash
docker compose logs backend
# 常见原因：JWT_SECRET 未配置、端口被占用
```

**无法访问页面**
```bash
docker compose ps
netstat -tlnp | grep 80

# 检查防火墙
sudo ufw allow 80/tcp
```

**API 返回 502**
```bash
docker compose logs backend
docker network inspect activation-code_app-network
```

**Git 拉取失败（私有仓库）**
```bash
ssh-keygen -t ed25519 -C "your-email@example.com"
cat ~/.ssh/id_ed25519.pub
# 添加到 GitHub SSH Keys
ssh -T git@github.com
```

**重置部署**
```bash
docker compose down -v  # 警告：会删除数据！
docker compose up -d --build
```

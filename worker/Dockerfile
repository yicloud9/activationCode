FROM node:20-alpine AS builder

# 安装 SQLite 编译依赖
RUN apk add --no-cache python3 make g++ sqlite

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
RUN npm ci

# 复制源代码
COPY . .

# 构建 TypeScript
RUN npm run build

# 生产环境镜像
FROM node:20-alpine

# 安装运行时依赖
RUN apk add --no-cache sqlite

WORKDIR /app

# 复制依赖和构建产物
COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY schema.sql ./

# 创建数据目录
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "dist/server.js"]

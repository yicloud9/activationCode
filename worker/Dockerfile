FROM node:20-alpine AS builder

# 安装 SQLite 编译依赖
RUN apk add --no-cache python3 make g++ sqlite

WORKDIR /app

# 配置 npm 镜像源加速
RUN npm config set registry https://registry.npmmirror.com

# 复制依赖文件
COPY package*.json ./
RUN npm ci

# 复制源代码
COPY . .

# 构建 TypeScript
RUN npm run build

# 只保留生产依赖
RUN rm -rf node_modules && npm ci --omit=dev

# 生产环境镜像
FROM node:20-alpine

# 安装运行时依赖
RUN apk add --no-cache sqlite

WORKDIR /app

# 从 builder 复制已编译的 node_modules 和构建产物
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY schema.sql ./

# 创建数据目录
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "dist/server.js"]

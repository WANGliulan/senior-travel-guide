# ============================================================
# 智游康行 · 岁旅相伴  ——  后端服务容器化
#
# 构建（在【仓库根目录】执行）：
#     docker build -t zykx-server .
# 运行：
#     docker run -d -p 3000:3000 --env-file server/.env zykx-server
#
# 说明：知识库复用 cloudfunctions/_shared/data.js，因此构建上下文必须是仓库根目录。
#      云平台（Render / Railway / 腾讯云托管 / 阿里云 FC）默认就以仓库根为上下文，可直接识别本文件。
# ============================================================
FROM node:18-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    TZ=Asia/Shanghai

WORKDIR /app

# 后端服务本体（零第三方依赖，无需 npm install）
COPY server/ /app/server/
# 公共知识库（server/lib/knowledge.js 默认从此处加载）
COPY cloudfunctions/_shared/ /app/cloudfunctions/_shared/
# 根目录 package.json（提供 npm start）
COPY package.json /app/package.json

# 方案持久化目录（建议挂载数据卷：-v zykx-data:/app/server/data）
RUN mkdir -p /app/server/data
VOLUME ["/app/server/data"]

EXPOSE 3000

# 健康检查：直接访问 /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "/app/server/index.js"]

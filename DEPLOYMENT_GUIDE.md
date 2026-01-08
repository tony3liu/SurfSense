# SurfSense Docker Compose 部署手册

## 📋 目录

- [项目概述](#项目概述)
- [系统要求](#系统要求)
- [架构说明](#架构说明)
- [快速开始](#快速开始)
- [详细配置](#详细配置)
- [播客功能配置](#播客功能配置)
- [生产环境部署](#生产环境部署)
- [启动和停止](#启动和停止)
- [数据库迁移](#数据库迁移)
- [监控和维护](#监控和维护)
- [故障排查](#故障排查)
- [常见问题](#常见问题)
- [备份和恢复](#备份和恢复)

---

## 项目概述

SurfSense 是一个高度可定制的 AI 研究助手，支持与个人知识库集成。主要特性包括：

- 📁 支持 50+ 种文件格式上传
- 🔍 强大的混合搜索（语义搜索 + 全文搜索）
- 💬 与知识库对话，获得引用答案
- 🎙️ **播客生成功能**（支持文档上传、自定义 TTS 配置）
- 👥 团队协作与 RBAC 权限控制
- 🔌 外部数据源集成（Google Drive、Slack、Jira 等）
- 🤖 支持 100+ 种 LLM 模型

---

## 系统要求

### 硬件要求

**最低配置**：
- CPU: 2 核心
- RAM: 4 GB
- 磁盘: 20 GB 可用空间

**推荐配置**：
- CPU: 4 核心或更多
- RAM: 8 GB 或更多
- 磁盘: 50 GB SSD
- （可选）GPU: 用于本地 TTS/STT 服务

**生产环境配置**：
- CPU: 8 核心或更多
- RAM: 16 GB 或更多
- 磁盘: 100 GB SSD
- 独立的 PostgreSQL 和 Redis 服务器

### 软件要求

- **Docker**: 版本 20.10 或更高
- **Docker Compose**: 版本 2.0 或更高
- **操作系统**:
  - Linux (Ubuntu 20.04+, Debian 11+, CentOS 8+)
  - macOS 11.0+
  - Windows 10/11 (WSL2)

### 网络要求

- 端口 `3000` (前端)
- 端口 `8000` (后端 API)
- 端口 `5432` (PostgreSQL - 可选，仅开发环境)
- 端口 `6379` (Redis - 可选，仅开发环境)
- 端口 `5050` (pgAdmin - 可选，仅开发环境)
- 端口 `5555` (Flower - 可选，Celery 监控)

---

## 架构说明

### 服务组件

```
┌─────────────────────────────────────────────────────────────┐
│                        SurfSense 架构                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │   Frontend   │ ───────→│   Backend    │                 │
│  │   (Next.js)  │         │  (FastAPI)   │                 │
│  │   Port 3000  │         │   Port 8000  │                 │
│  └──────────────┘         └──────┬───────┘                 │
│                                   │                          │
│                           ┌───────┴────────┐                │
│                           ↓                ↓                 │
│                  ┌────────────┐   ┌────────────┐            │
│                  │ PostgreSQL │   │   Redis    │            │
│                  │  (pgvector)│   │  (Celery)  │            │
│                  │ Port 5432  │   │ Port 6379  │            │
│                  └────────────┘   └──────┬─────┘            │
│                                          │                   │
│                                   ┌──────┴──────┐            │
│                                   │   Celery    │            │
│                                   │   Workers   │            │
│                                   │  (异步任务) │            │
│                                   └─────────────┘            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 服务说明

| 服务 | 说明 | 端口 |
|------|------|------|
| **frontend** | Next.js 14 前端应用 | 3000 |
| **backend** | FastAPI 后端 API | 8000 |
| **db** | PostgreSQL 15 + pgvector 扩展 | 5432 |
| **redis** | Redis 7 (Celery broker/backend) | 6379 |
| **pgadmin** | PostgreSQL 管理界面（可选） | 5050 |
| **celery_worker** | 异步任务处理（生产环境） | - |
| **celery_beat** | 定时任务调度（生产环境） | - |
| **flower** | Celery 监控工具（可选） | 5555 |

---

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/MODSetter/SurfSense.git
cd SurfSense
```

### 2. 配置环境变量

#### 2.1 根目录配置

复制根目录的环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env` 文件（基础配置）：

```env
# 数据库配置
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=surfsense
POSTGRES_PORT=5432

# Redis 配置
REDIS_PORT=6379

# 前端配置
FRONTEND_PORT=3000
NEXT_PUBLIC_FASTAPI_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_FASTAPI_BACKEND_AUTH_TYPE=LOCAL
NEXT_PUBLIC_ETL_SERVICE=DOCLING

# 后端配置
BACKEND_PORT=8000

# pgAdmin 配置（可选）
PGADMIN_PORT=5050
PGADMIN_DEFAULT_EMAIL=admin@surfsense.com
PGADMIN_DEFAULT_PASSWORD=admin_password_here
```

#### 2.2 后端配置

```bash
cp surfsense_backend/.env.example surfsense_backend/.env
```

编辑 `surfsense_backend/.env`（**重要配置**）：

```env
# 数据库连接（Docker 内部使用）
DATABASE_URL=postgresql+asyncpg://postgres:your_secure_password_here@db:5432/surfsense

# Celery 配置（Docker 内部使用）
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

# 应用密钥（请更改为随机字符串）
SECRET_KEY=your_random_secret_key_min_32_characters_long

# 前端 URL
NEXT_FRONTEND_URL=http://localhost:3000

# 认证配置
AUTH_TYPE=LOCAL
REGISTRATION_ENABLED=TRUE

# Google OAuth（如果使用 GOOGLE 认证）
# GOOGLE_OAUTH_CLIENT_ID=your_google_client_id
# GOOGLE_OAUTH_CLIENT_SECRET=your_google_client_secret

# 嵌入模型（本地模型，无需 API Key）
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2

# 重排序模型（可选）
RERANKERS_ENABLED=FALSE
# RERANKERS_MODEL_NAME=ms-marco-MiniLM-L-12-v2
# RERANKERS_MODEL_TYPE=flashrank

# 文件解析服务
ETL_SERVICE=DOCLING
# UNSTRUCTURED_API_KEY=your_key_here  # 如果使用 UNSTRUCTURED
# LLAMA_CLOUD_API_KEY=your_key_here   # 如果使用 LLAMACLOUD

# TTS 服务（播客功能）
TTS_SERVICE=local/kokoro
# TTS_SERVICE=openai/tts-1  # 使用 OpenAI TTS
# TTS_SERVICE_API_KEY=sk-xxx  # OpenAI API Key

# STT 服务（语音转文字）
STT_SERVICE=local/base
# STT_SERVICE=openai/whisper-1  # 使用 OpenAI Whisper
# STT_SERVICE_API_KEY=sk-xxx    # OpenAI API Key

# Firecrawl（网页抓取，可选）
# FIRECRAWL_API_KEY=fcr-xxx

# LangSmith（可观测性，可选）
LANGSMITH_TRACING=false
# LANGSMITH_API_KEY=lsv2_pt_xxx
# LANGSMITH_PROJECT=surfsense

# Uvicorn 配置
UVICORN_HOST=0.0.0.0
UVICORN_PORT=8000
UVICORN_LOG_LEVEL=info

# 定时任务检查间隔
SCHEDULE_CHECKER_INTERVAL=5m

# 页面限制（ETL 服务）
PAGES_LIMIT=500
```

#### 2.3 前端配置

```bash
cp surfsense_web/.env.example surfsense_web/.env
```

编辑 `surfsense_web/.env`：

```env
NEXT_PUBLIC_FASTAPI_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_FASTAPI_BACKEND_AUTH_TYPE=LOCAL
NEXT_PUBLIC_ETL_SERVICE=DOCLING
```

### 3. 构建 Docker 镜像

在首次部署或代码更新后，需要构建 Docker 镜像。

#### 方法 1: 使用 Docker Compose 构建（推荐）

```bash
# 构建所有服务的镜像
docker-compose build

# 仅构建特定服务
docker-compose build backend
docker-compose build frontend

# 强制重新构建（不使用缓存）
docker-compose build --no-cache

# 并行构建多个服务
docker-compose build --parallel
```

#### 方法 2: 使用 Docker 命令单独构建

```bash
# 构建后端镜像
docker build -t surfsense-backend:latest ./surfsense_backend

# 构建前端镜像（需要传递构建参数）
docker build -t surfsense-frontend:latest \
  --build-arg NEXT_PUBLIC_FASTAPI_BACKEND_URL=http://localhost:8000 \
  --build-arg NEXT_PUBLIC_FASTAPI_BACKEND_AUTH_TYPE=LOCAL \
  --build-arg NEXT_PUBLIC_ETL_SERVICE=DOCLING \
  ./surfsense_web

# 查看已构建的镜像
docker images | grep surfsense
```

#### 方法 3: 构建并启动（一步完成）

```bash
# 构建并启动所有服务
docker-compose up -d --build

# 强制重新构建并启动
docker-compose up -d --build --force-recreate
```

### 4. 启动服务

#### 开发环境（推荐）

```bash
# 启动所有服务（会自动构建镜像）
docker-compose up -d

# 查看日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend
docker-compose logs -f frontend
```

#### 等待服务启动

首次启动需要下载镜像和构建，可能需要 5-10 分钟。

检查服务状态：

```bash
docker-compose ps
```

所有服务应显示为 `Up` 状态。

### 5. 初始化数据库

后端服务启动时会自动创建数据库表。如果需要手动迁移：

```bash
docker-compose exec backend alembic upgrade head
```

### 6. 访问应用

- **前端**: http://localhost:3000
- **后端 API 文档**: http://localhost:8000/docs
- **pgAdmin**: http://localhost:5050 (可选)

### 7. 创建管理员账户

访问 http://localhost:3000，点击 "Sign Up" 创建第一个账户。第一个注册的用户将自动成为管理员。

---

## 详细配置

### 认证配置

#### 本地认证（默认）

```env
# surfsense_backend/.env
AUTH_TYPE=LOCAL
REGISTRATION_ENABLED=TRUE

# 根目录 .env
NEXT_PUBLIC_FASTAPI_BACKEND_AUTH_TYPE=LOCAL
```

#### Google OAuth 认证

1. 在 [Google Cloud Console](https://console.cloud.google.com/) 创建 OAuth 凭据
2. 设置授权重定向 URI：
   - `http://localhost:8000/api/v1/auth/google/callback`（开发环境）
   - `https://yourdomain.com/api/v1/auth/google/callback`（生产环境）

3. 配置环境变量：

```env
# surfsense_backend/.env
AUTH_TYPE=GOOGLE
GOOGLE_OAUTH_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your_google_client_secret

# 根目录 .env
NEXT_PUBLIC_FASTAPI_BACKEND_AUTH_TYPE=GOOGLE
```

### LLM 配置

SurfSense 通过 LiteLLM 支持 100+ 种 LLM 模型。配置通过 Web UI 完成：

1. 登录后访问 **Settings → Platform → Manage LLMs**
2. 点击 "Add LLM Configuration"
3. 填写配置：

**OpenAI 示例**：
```
Model Name: GPT-4o
Model: gpt-4o
API Base: https://api.openai.com/v1
API Key: sk-your_api_key_here
```

**本地 Ollama 示例**：
```
Model Name: Llama 3.2
Model: ollama/llama3.2
API Base: http://host.docker.internal:11434
API Key: (留空)
```

**Azure OpenAI 示例**：
```
Model Name: GPT-4 Azure
Model: azure/gpt-4-deployment-name
API Base: https://your-resource.openai.azure.com
API Key: your_azure_api_key
API Version: 2024-02-15-preview
```

### 嵌入模型配置

#### 本地模型（推荐，无需 API）

```env
# surfsense_backend/.env
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

其他本地模型选项：
- `sentence-transformers/all-mpnet-base-v2` (更高精度)
- `BAAI/bge-small-en-v1.5` (多语言支持)

#### API 模型

```env
# OpenAI Embeddings
EMBEDDING_MODEL=openai://text-embedding-3-small
# 需在 LLM 配置中添加 OpenAI API Key

# Cohere Embeddings
EMBEDDING_MODEL=cohere://embed-english-v3.0
# 需在 LLM 配置中添加 Cohere API Key
```

### 文件解析配置

#### Docling（推荐，免费本地解析）

```env
# surfsense_backend/.env
ETL_SERVICE=DOCLING

# 根目录 .env
NEXT_PUBLIC_ETL_SERVICE=DOCLING
```

#### Unstructured API

```env
ETL_SERVICE=UNSTRUCTURED
UNSTRUCTURED_API_KEY=your_unstructured_api_key

NEXT_PUBLIC_ETL_SERVICE=UNSTRUCTURED
```

#### LlamaCloud

```env
ETL_SERVICE=LLAMACLOUD
LLAMA_CLOUD_API_KEY=your_llamacloud_api_key

NEXT_PUBLIC_ETL_SERVICE=LLAMACLOUD
```

### 网页抓取配置

#### Firecrawl（推荐）

```env
FIRECRAWL_API_KEY=fcr-your_firecrawl_api_key
```

#### 本地抓取（Chromium + Trafilatura）

无需额外配置，Docker 镜像已包含 Chromium。

---

## 播客功能配置

### TTS（文本转语音）服务

#### 方案 1: 本地 Kokoro TTS（推荐，免费）

```env
# surfsense_backend/.env
TTS_SERVICE=local/kokoro
```

**优点**：
- 完全免费
- 无需 API Key
- 低延迟
- 支持多种音色（美式英语男女声）

**缺点**：
- 占用更多 CPU/内存
- 音质略低于云服务

**支持的音色**：
- `af_bella` - 女声（美式英语）
- `af_sarah` - 女声（美式英语）
- `am_adam` - 男声（美式英语）
- `am_michael` - 男声（美式英语）
- 等 40+ 种音色

#### 方案 2: OpenAI TTS

```env
TTS_SERVICE=openai/tts-1
TTS_SERVICE_API_KEY=sk-your_openai_api_key
```

**支持的音色**：
- `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`

**定价**（参考）：
- $15.00 / 1M 字符

#### 方案 3: Azure TTS

```env
TTS_SERVICE=azure/tts-1
TTS_SERVICE_API_KEY=your_azure_key
TTS_SERVICE_API_BASE=https://your-region.tts.speech.microsoft.com
```

#### 方案 4: Google Vertex AI TTS

```env
TTS_SERVICE=vertex_ai/test
TTS_SERVICE_API_KEY=your_google_cloud_api_key
```

### STT（语音转文字）服务

#### 方案 1: 本地 Faster-Whisper（推荐）

```env
STT_SERVICE=local/base
```

**模型大小选项**：
- `local/tiny` - 最快，精度较低
- `local/base` - 平衡（推荐）
- `local/small` - 更高精度
- `local/medium` - 高精度，较慢
- `local/large-v3` - 最高精度，最慢

#### 方案 2: OpenAI Whisper API

```env
STT_SERVICE=openai/whisper-1
STT_SERVICE_API_KEY=sk-your_openai_api_key
```

### 播客功能使用

配置完成后，用户可以通过以下方式生成播客：

1. **通过聊天界面**：
   - 在对话中说 "Generate a podcast about this conversation"
   - Agent 会自动调用 `generate_podcast` tool

2. **通过独立页面**（新增功能）：
   - 访问 `/dashboard/[search_space_id]/podcasts`
   - **上传文档**（PDF、DOCX、TXT、MD）或**输入文本**
   - **选择 TTS 提供商和音色**（支持自定义两个角色的音色）
   - 点击 "Generate Podcast" 生成
   - 在历史列表中查看、播放、下载生成的播客

---

## 生产环境部署

### 架构调整

生产环境建议将 Celery Worker 独立部署，提升稳定性和扩展性。

#### 1. 修改 docker-compose.yml

取消注释以下服务：

```yaml
services:
  # ... 其他服务 ...

  # 独立 Celery Worker
  celery_worker:
    build: ./surfsense_backend
    command: celery -A app.celery_app worker --loglevel=info --concurrency=2 --pool=solo
    volumes:
      - ./surfsense_backend:/app
      - shared_temp:/tmp
    env_file:
      - ./surfsense_backend/.env
    environment:
      - DATABASE_URL=postgresql+asyncpg://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@db:5432/${POSTGRES_DB:-surfsense}
      - CELERY_BROKER_URL=redis://redis:${REDIS_PORT:-6379}/0
      - CELERY_RESULT_BACKEND=redis://redis:${REDIS_PORT:-6379}/0
      - PYTHONPATH=/app
    depends_on:
      - db
      - redis
      - backend
    restart: always

  # 定时任务调度
  celery_beat:
    build: ./surfsense_backend
    command: celery -A app.celery_app beat --loglevel=info
    volumes:
      - ./surfsense_backend:/app
      - shared_temp:/tmp
    env_file:
      - ./surfsense_backend/.env
    environment:
      - DATABASE_URL=postgresql+asyncpg://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@db:5432/${POSTGRES_DB:-surfsense}
      - CELERY_BROKER_URL=redis://redis:${REDIS_PORT:-6379}/0
      - CELERY_RESULT_BACKEND=redis://redis:${REDIS_PORT:-6379}/0
      - PYTHONPATH=/app
    depends_on:
      - db
      - redis
      - celery_worker
    restart: always

  # Celery 监控（可选）
  flower:
    build: ./surfsense_backend
    command: celery -A app.celery_app flower --port=5555
    ports:
      - "${FLOWER_PORT:-5555}:5555"
    env_file:
      - ./surfsense_backend/.env
    environment:
      - CELERY_BROKER_URL=redis://redis:${REDIS_PORT:-6379}/0
      - CELERY_RESULT_BACKEND=redis://redis:${REDIS_PORT:-6379}/0
      - PYTHONPATH=/app
    depends_on:
      - redis
      - celery_worker
    restart: always
```

#### 2. 调整并发配置

根据服务器配置调整 Celery Worker 并发数：

```yaml
# 4 核 CPU
command: celery -A app.celery_app worker --loglevel=info --concurrency=4 --pool=solo

# 8 核 CPU
command: celery -A app.celery_app worker --loglevel=info --concurrency=8 --pool=solo
```

### 使用预构建镜像

生产环境可以使用 GitHub Container Registry 的预构建镜像，无需本地构建：

#### 方法 1: 拉取并使用官方镜像

```bash
# 拉取最新镜像
docker pull ghcr.io/modsetter/surfsense_backend:latest
docker pull ghcr.io/modsetter/surfsense_ui:latest

# 修改 docker-compose.yml
# 注释掉 build 字段，使用 image 字段
```

编辑 `docker-compose.yml`：

```yaml
services:
  backend:
    image: ghcr.io/modsetter/surfsense_backend:latest
    # build: ./surfsense_backend
    # ... 其他配置

  frontend:
    image: ghcr.io/modsetter/surfsense_ui:latest
    # build: ./surfsense_web
    # ... 其他配置
```

#### 方法 2: 自行构建生产镜像

如果需要自定义或使用最新代码：

```bash
# 构建后端生产镜像
docker build -t your-registry.com/surfsense-backend:v1.0.0 \
  -f surfsense_backend/Dockerfile \
  ./surfsense_backend

# 构建前端生产镜像
docker build -t your-registry.com/surfsense-frontend:v1.0.0 \
  --build-arg NEXT_PUBLIC_FASTAPI_BACKEND_URL=https://api.yourdomain.com \
  --build-arg NEXT_PUBLIC_FASTAPI_BACKEND_AUTH_TYPE=LOCAL \
  --build-arg NEXT_PUBLIC_ETL_SERVICE=DOCLING \
  -f surfsense_web/Dockerfile \
  ./surfsense_web

# 推送到私有镜像仓库
docker push your-registry.com/surfsense-backend:v1.0.0
docker push your-registry.com/surfsense-frontend:v1.0.0
```

#### 方法 3: 多阶段构建优化

对于更小的生产镜像：

```bash
# 使用 Docker BuildKit
export DOCKER_BUILDKIT=1

# 构建优化后的镜像
docker build --target production \
  -t surfsense-backend:production \
  ./surfsense_backend
```

### 反向代理配置（Nginx）

#### 安装 Nginx

```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx
```

#### 创建配置文件

```bash
sudo nano /etc/nginx/sites-available/surfsense
```

```nginx
# HTTP → HTTPS 重定向
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS 配置
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com;

    # SSL 证书（Let's Encrypt）
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 前端
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 文件上传大小限制
        client_max_body_size 100M;
    }

    # WebSocket 支持（如果需要）
    location /ws/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

#### 启用配置

```bash
sudo ln -s /etc/nginx/sites-available/surfsense /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 获取 SSL 证书

```bash
sudo certbot --nginx -d yourdomain.com
```

#### 更新环境变量

```env
# 根目录 .env
NEXT_PUBLIC_FASTAPI_BACKEND_URL=https://yourdomain.com

# surfsense_backend/.env
NEXT_FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://yourdomain.com
```

### 数据库和 Redis 外部托管

#### 使用 Supabase（PostgreSQL）

```env
# surfsense_backend/.env
DATABASE_URL=postgresql+asyncpg://postgres:[password]@db.xxx.supabase.co:5432/postgres
```

#### 使用 Redis Cloud

```env
# surfsense_backend/.env
CELERY_BROKER_URL=redis://default:[password]@redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com:12345/0
CELERY_RESULT_BACKEND=redis://default:[password]@redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com:12345/0
```

#### 移除本地数据库服务

```yaml
services:
  # 注释掉或删除 db 和 redis 服务
  # db:
  #   ...
  # redis:
  #   ...
```

---

## 启动和停止

### 启动服务

```bash
# 启动所有服务（后台运行）
docker-compose up -d

# 启动特定服务
docker-compose up -d backend frontend

# 启动并查看日志
docker-compose up
```

### 停止服务

```bash
# 停止所有服务
docker-compose down

# 停止并删除数据卷（谨慎！）
docker-compose down -v
```

### 重启服务

```bash
# 重启所有服务
docker-compose restart

# 重启特定服务
docker-compose restart backend
```

### 重新构建镜像

```bash
# 重新构建所有镜像
docker-compose build

# 重新构建特定服务
docker-compose build backend

# 重新构建并启动
docker-compose up -d --build
```

### 查看日志

```bash
# 查看所有日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend

# 查看最近 100 行日志
docker-compose logs --tail=100 backend

# 查看实时日志（最近 50 行）
docker-compose logs -f --tail=50
```

### 查看服务状态

```bash
# 查看所有服务状态
docker-compose ps

# 查看详细信息
docker-compose ps -a
```

---

## 数据库迁移

### 创建新迁移

当数据库模型发生变化时（如新增播客功能的字段）：

```bash
# 进入后端容器
docker-compose exec backend bash

# 创建迁移文件
alembic revision --autogenerate -m "add podcast tts and source fields"

# 应用迁移
alembic upgrade head

# 退出容器
exit
```

### 查看迁移历史

```bash
docker-compose exec backend alembic history
```

### 回滚迁移

```bash
# 回滚到上一个版本
docker-compose exec backend alembic downgrade -1

# 回滚到特定版本
docker-compose exec backend alembic downgrade <revision_id>
```

### 初始化数据库（全新安装）

```bash
# 删除现有数据（谨慎！）
docker-compose down -v

# 启动服务
docker-compose up -d

# 应用所有迁移
docker-compose exec backend alembic upgrade head
```

---

## 监控和维护

### 使用 Flower 监控 Celery

启用 Flower 服务（取消 docker-compose.yml 中的注释）：

```bash
docker-compose up -d flower
```

访问 http://localhost:5555 查看：
- 活跃的 Worker
- 任务执行状态
- 队列长度
- 任务统计

### 使用 pgAdmin 管理数据库

访问 http://localhost:5050

**首次登录**：
- Email: `admin@surfsense.com` (或 .env 中配置的)
- Password: `surfsense` (或 .env 中配置的)

**添加服务器连接**：
1. 右键 "Servers" → "Register" → "Server"
2. General Tab:
   - Name: `SurfSense DB`
3. Connection Tab:
   - Host: `db`
   - Port: `5432`
   - Database: `surfsense`
   - Username: `postgres`
   - Password: (你的数据库密码)

### 查看资源使用

```bash
# 查看 Docker 容器资源使用
docker stats

# 查看特定服务资源使用
docker stats surfsense-backend-1 surfsense-frontend-1
```

### 清理未使用的资源

```bash
# 清理未使用的容器、网络、镜像
docker system prune

# 清理所有未使用的镜像
docker image prune -a

# 清理未使用的数据卷（谨慎！）
docker volume prune
```

---

## 故障排查

### 1. 服务启动失败

#### 问题：端口已被占用

```
Error: bind: address already in use
```

**解决方案**：

```bash
# 检查端口占用
sudo lsof -i :3000
sudo lsof -i :8000

# 修改 .env 中的端口
FRONTEND_PORT=3001
BACKEND_PORT=8001
```

#### 问题：数据库连接失败

```
ERROR: Failed to connect to database
```

**解决方案**：

```bash
# 检查数据库服务状态
docker-compose ps db

# 查看数据库日志
docker-compose logs db

# 重启数据库
docker-compose restart db

# 检查 .env 配置是否正确
cat surfsense_backend/.env | grep DATABASE_URL
```

### 2. 前端无法访问后端

#### 问题：CORS 错误

```
Access to fetch at 'http://localhost:8000' has been blocked by CORS policy
```

**解决方案**：

检查环境变量配置：

```env
# surfsense_backend/.env
NEXT_FRONTEND_URL=http://localhost:3000

# 根目录 .env 和 surfsense_web/.env
NEXT_PUBLIC_FASTAPI_BACKEND_URL=http://localhost:8000
```

确保前端和后端 URL 配置一致。

### 3. 播客生成失败

#### 问题：TTS 服务不可用

```
ERROR: TTS service not available
```

**解决方案**：

```bash
# 检查 TTS 配置
docker-compose exec backend cat /app/.env | grep TTS_SERVICE

# 如果使用本地 Kokoro
TTS_SERVICE=local/kokoro

# 如果使用 OpenAI，检查 API Key
TTS_SERVICE=openai/tts-1
TTS_SERVICE_API_KEY=sk-xxx

# 查看后端日志
docker-compose logs -f backend | grep -i tts
```

#### 问题：Celery Worker 未运行

```
ERROR: Task failed: No worker available
```

**解决方案**：

```bash
# 检查 Celery Worker 状态
docker-compose ps celery_worker

# 如果未启动，检查 docker-compose.yml 是否取消注释
# 启动 Celery Worker
docker-compose up -d celery_worker

# 查看 Worker 日志
docker-compose logs -f celery_worker
```

### 4. 文件上传失败

#### 问题：文件大小超限

```
ERROR: File size exceeds limit
```

**解决方案**：

调整 Nginx 配置（如果使用）：

```nginx
# /etc/nginx/sites-available/surfsense
location /api/ {
    # ...
    client_max_body_size 100M;  # 增加限制
}
```

调整后端配置（可选）：

```env
# surfsense_backend/.env
PAGES_LIMIT=1000
```

### 5. 内存不足

#### 问题：容器频繁重启

```bash
docker-compose ps
# Status: Restarting
```

**解决方案**：

```bash
# 查看日志
docker-compose logs backend | tail -50

# 检查内存使用
docker stats

# 如果内存不足，考虑：
# 1. 增加服务器内存
# 2. 减少 Celery Worker 并发数
# 3. 使用外部数据库服务
# 4. 使用云 TTS 服务（而非本地）
```

### 6. 数据库迁移失败

#### 问题：迁移版本冲突

```
ERROR: (sqlalchemy.exc.OperationalError) relation "podcasts" already exists
```

**解决方案**：

```bash
# 查看当前迁移版本
docker-compose exec backend alembic current

# 标记为已应用（不实际执行 SQL）
docker-compose exec backend alembic stamp head

# 或者重置数据库（谨慎！会丢失数据）
docker-compose down -v
docker-compose up -d
docker-compose exec backend alembic upgrade head
```

---

## 常见问题

### Q1: 如何更换 LLM 模型？

**A**: 登录后访问 **Settings → Platform → Manage LLMs**，添加新的 LLM 配置。然后在 **Settings → Search Space Settings** 中选择新模型。

### Q2: 如何添加 Google Drive 连接器？

**A**:
1. 在 Google Cloud Console 创建 OAuth 凭据
2. 添加授权重定向 URI：`http://localhost:8000/api/v1/auth/google/drive/connector/callback`
3. 在 `surfsense_backend/.env` 中配置：
   ```env
   GOOGLE_OAUTH_CLIENT_ID=your_client_id
   GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret
   GOOGLE_DRIVE_REDIRECT_URI=http://localhost:8000/api/v1/auth/google/drive/connector/callback
   ```
4. 重启后端服务
5. 在 Web UI 中访问 **Connectors → Add Google Drive**

### Q3: 如何使用本地 Ollama 模型？

**A**:
1. 在宿主机安装 Ollama：`curl https://ollama.ai/install.sh | sh`
2. 下载模型：`ollama pull llama3.2`
3. 在 Web UI 添加 LLM 配置：
   - Model: `ollama/llama3.2`
   - API Base: `http://host.docker.internal:11434` (macOS/Windows) 或 `http://172.17.0.1:11434` (Linux)

### Q4: 如何备份数据？

**A**: 参见 [备份和恢复](#备份和恢复) 章节。

### Q5: 如何启用 LangSmith 可观测性？

**A**:
```env
# surfsense_backend/.env
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_pt_your_key
LANGSMITH_PROJECT=surfsense
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
```

重启后端服务后，所有 LLM 调用将被记录到 LangSmith。

### Q6: 如何自定义播客音色？

**A**:
1. 访问 `/dashboard/[search_space_id]/podcasts`
2. 在 "TTS Configuration" 部分：
   - 选择 TTS 提供商（OpenAI、Vertex AI、Kokoro、Azure）
   - 为 Speaker 1 选择音色（如 `alloy`）
   - 为 Speaker 2 选择音色（如 `echo`）
3. 上传文档或输入文本，生成播客

### Q7: 如何修改定时任务检查间隔？

**A**:
```env
# surfsense_backend/.env
# 可选值: 1m, 5m, 10m, 1h, 2h
SCHEDULE_CHECKER_INTERVAL=10m
```

---

## 备份和恢复

### 数据库备份

#### 方法 1: pg_dump（推荐）

```bash
# 备份数据库
docker-compose exec -T db pg_dump -U postgres surfsense > backup_$(date +%Y%m%d_%H%M%S).sql

# 压缩备份
gzip backup_*.sql
```

#### 方法 2: Docker 数据卷备份

```bash
# 停止服务
docker-compose stop backend frontend celery_worker

# 备份 postgres_data 数据卷
docker run --rm \
  -v surfsense_postgres_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/postgres_backup_$(date +%Y%m%d).tar.gz -C /data .

# 启动服务
docker-compose start backend frontend celery_worker
```

### 数据库恢复

#### 方法 1: 从 SQL 文件恢复

```bash
# 解压备份（如果是 .gz）
gunzip backup_20241231_120000.sql.gz

# 停止服务
docker-compose down

# 启动数据库
docker-compose up -d db

# 等待数据库启动
sleep 10

# 恢复数据
cat backup_20241231_120000.sql | docker-compose exec -T db psql -U postgres surfsense

# 启动所有服务
docker-compose up -d
```

#### 方法 2: 从数据卷恢复

```bash
# 停止服务
docker-compose down

# 删除现有数据卷
docker volume rm surfsense_postgres_data

# 恢复数据卷
docker run --rm \
  -v surfsense_postgres_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/postgres_backup_20241231.tar.gz -C /data

# 启动服务
docker-compose up -d
```

### Redis 备份

```bash
# 触发 Redis 保存
docker-compose exec redis redis-cli SAVE

# 复制 RDB 文件
docker-compose exec redis cat /data/dump.rdb > redis_backup_$(date +%Y%m%d).rdb
```

### 完整系统备份脚本

创建 `backup.sh`：

```bash
#!/bin/bash

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

echo "Backing up database..."
docker-compose exec -T db pg_dump -U postgres surfsense | gzip > $BACKUP_DIR/db_$DATE.sql.gz

echo "Backing up Redis..."
docker-compose exec redis redis-cli SAVE
docker-compose exec redis cat /data/dump.rdb > $BACKUP_DIR/redis_$DATE.rdb

echo "Backing up environment files..."
tar czf $BACKUP_DIR/env_$DATE.tar.gz .env surfsense_backend/.env surfsense_web/.env

echo "Backup completed: $BACKUP_DIR"
```

运行备份：

```bash
chmod +x backup.sh
./backup.sh
```

### 自动备份（Cron）

```bash
# 编辑 crontab
crontab -e

# 添加每日凌晨 2 点备份
0 2 * * * cd /path/to/SurfSense && ./backup.sh >> /var/log/surfsense_backup.log 2>&1
```

---

## 性能优化

### 1. 数据库优化

#### 增加 PostgreSQL 连接数

```yaml
# docker-compose.yml
services:
  db:
    environment:
      - POSTGRES_MAX_CONNECTIONS=200
```

#### 优化 PostgreSQL 配置

```bash
docker-compose exec db bash -c 'echo "shared_buffers = 256MB" >> /var/lib/postgresql/data/postgresql.conf'
docker-compose exec db bash -c 'echo "effective_cache_size = 1GB" >> /var/lib/postgresql/data/postgresql.conf'
docker-compose restart db
```

### 2. Redis 优化

```yaml
# docker-compose.yml
services:
  redis:
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
```

### 3. Celery Worker 扩展

```yaml
services:
  celery_worker:
    deploy:
      replicas: 3  # 启动 3 个 Worker 实例
```

### 4. 前端缓存

在 Nginx 配置中添加：

```nginx
location /_next/static/ {
    proxy_pass http://localhost:3000;
    proxy_cache_valid 200 1y;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

---

## 安全建议

### 1. 更改默认密码

```env
# .env
POSTGRES_PASSWORD=use_strong_random_password_here
PGADMIN_DEFAULT_PASSWORD=another_strong_password
SECRET_KEY=generate_random_32_char_secret_key
```

### 2. 限制端口暴露

生产环境不要暴露内部端口：

```yaml
services:
  db:
    # ports:
    #   - "5432:5432"  # 注释掉，仅容器内访问
  redis:
    # ports:
    #   - "6379:6379"  # 注释掉
```

### 3. 启用 HTTPS

参见 [反向代理配置](#反向代理配置nginx) 章节。

### 4. 定期更新

```bash
# 拉取最新代码
git pull origin main

# 更新镜像
docker-compose pull

# 重启服务
docker-compose up -d --build
```

### 5. 使用 Docker Secrets（Swarm 模式）

```yaml
services:
  backend:
    secrets:
      - db_password
      - secret_key

secrets:
  db_password:
    file: ./secrets/db_password.txt
  secret_key:
    file: ./secrets/secret_key.txt
```

---

## 升级指南

### 从旧版本升级

1. **备份数据**（重要！）
   ```bash
   ./backup.sh
   ```

2. **拉取最新代码**
   ```bash
   git pull origin main
   ```

3. **检查环境变量变化**
   ```bash
   diff .env.example .env
   diff surfsense_backend/.env.example surfsense_backend/.env
   ```

4. **重新构建镜像**
   ```bash
   # 强制重新构建所有镜像（不使用缓存）
   docker-compose build --no-cache

   # 或者使用 Docker 命令单独构建
   docker build --no-cache -t surfsense-backend:latest ./surfsense_backend
   docker build --no-cache -t surfsense-frontend:latest \
     --build-arg NEXT_PUBLIC_FASTAPI_BACKEND_URL=http://localhost:8000 \
     --build-arg NEXT_PUBLIC_FASTAPI_BACKEND_AUTH_TYPE=LOCAL \
     --build-arg NEXT_PUBLIC_ETL_SERVICE=DOCLING \
     ./surfsense_web
   ```

5. **停止服务**
   ```bash
   docker-compose down
   ```

6. **应用数据库迁移**
   ```bash
   docker-compose up -d db redis
   docker-compose run --rm backend alembic upgrade head
   ```

7. **启动所有服务**
   ```bash
   docker-compose up -d
   ```

8. **验证升级**
   ```bash
   docker-compose ps
   docker-compose logs -f backend | head -50
   ```

---

## 卸载

### 完全删除 SurfSense

```bash
# 停止所有服务
docker-compose down

# 删除所有数据卷（警告：会删除所有数据！）
docker-compose down -v

# 删除镜像
docker rmi surfsense-backend surfsense-frontend

# 删除项目文件
cd ..
rm -rf SurfSense
```

---

## 支持和社区

- **GitHub Issues**: https://github.com/MODSetter/SurfSense/issues
- **Discord 社区**: https://discord.gg/ejRNvftDp9
- **官方文档**: https://github.com/MODSetter/SurfSense
- **中文文档**: https://github.com/MODSetter/SurfSense/blob/main/README.zh-CN.md

---

## 许可证

SurfSense 采用开源许可证发布。详情请参阅 [LICENSE](LICENSE) 文件。

---

**版本**: 1.0.0
**最后更新**: 2026-01-06
**维护者**: SurfSense Team

---

## 附录

### A. 完整环境变量清单

#### 根目录 `.env`

```env
# 数据库
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=surfsense
POSTGRES_PORT=5432

# Redis
REDIS_PORT=6379
FLOWER_PORT=5555

# 前端
FRONTEND_PORT=3000
NEXT_PUBLIC_FASTAPI_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_FASTAPI_BACKEND_AUTH_TYPE=LOCAL
NEXT_PUBLIC_ETL_SERVICE=DOCLING

# 后端
BACKEND_PORT=8000

# pgAdmin
PGADMIN_PORT=5050
PGADMIN_DEFAULT_EMAIL=admin@surfsense.com
PGADMIN_DEFAULT_PASSWORD=your_password
```

#### `surfsense_backend/.env`

```env
# 数据库
DATABASE_URL=postgresql+asyncpg://postgres:password@db:5432/surfsense

# Celery
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0
SCHEDULE_CHECKER_INTERVAL=5m

# 应用
SECRET_KEY=your_secret_key_min_32_chars
NEXT_FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000

# 认证
AUTH_TYPE=LOCAL
REGISTRATION_ENABLED=TRUE
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=

# 连接器
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:8000/api/v1/auth/google/calendar/connector/callback
GOOGLE_GMAIL_REDIRECT_URI=http://localhost:8000/api/v1/auth/google/gmail/connector/callback
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:8000/api/v1/auth/google/drive/connector/callback
AIRTABLE_CLIENT_ID=
AIRTABLE_CLIENT_SECRET=
AIRTABLE_REDIRECT_URI=http://localhost:8000/api/v1/auth/airtable/connector/callback

# 嵌入模型
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2

# 重排序
RERANKERS_ENABLED=FALSE
RERANKERS_MODEL_NAME=ms-marco-MiniLM-L-12-v2
RERANKERS_MODEL_TYPE=flashrank

# TTS
TTS_SERVICE=local/kokoro
TTS_SERVICE_API_KEY=
TTS_SERVICE_API_BASE=

# STT
STT_SERVICE=local/base
STT_SERVICE_API_KEY=
STT_SERVICE_API_BASE=

# ETL
ETL_SERVICE=DOCLING
UNSTRUCTURED_API_KEY=
LLAMA_CLOUD_API_KEY=
PAGES_LIMIT=500

# Firecrawl
FIRECRAWL_API_KEY=

# LangSmith
LANGSMITH_TRACING=false
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_API_KEY=
LANGSMITH_PROJECT=surfsense

# Uvicorn
UVICORN_HOST=0.0.0.0
UVICORN_PORT=8000
UVICORN_LOG_LEVEL=info
```

#### `surfsense_web/.env`

```env
NEXT_PUBLIC_FASTAPI_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_FASTAPI_BACKEND_AUTH_TYPE=LOCAL
NEXT_PUBLIC_ETL_SERVICE=DOCLING
```

### B. Docker 构建命令速查

```bash
# === Docker Compose 构建 ===
docker-compose build                    # 构建所有服务
docker-compose build backend            # 构建特定服务
docker-compose build --no-cache         # 强制重新构建（不使用缓存）
docker-compose build --parallel         # 并行构建
docker-compose up -d --build            # 构建并启动
docker-compose up -d --build --force-recreate  # 强制重新创建容器

# === Docker 单独构建 ===
# 构建后端
docker build -t surfsense-backend:latest ./surfsense_backend
docker build -t surfsense-backend:v1.0.0 \
  -f surfsense_backend/Dockerfile \
  ./surfsense_backend

# 构建前端（需要构建参数）
docker build -t surfsense-frontend:latest \
  --build-arg NEXT_PUBLIC_FASTAPI_BACKEND_URL=http://localhost:8000 \
  --build-arg NEXT_PUBLIC_FASTAPI_BACKEND_AUTH_TYPE=LOCAL \
  --build-arg NEXT_PUBLIC_ETL_SERVICE=DOCLING \
  ./surfsense_web

# 多架构构建（ARM64 + AMD64）
docker buildx build --platform linux/amd64,linux/arm64 \
  -t surfsense-backend:latest \
  --push \
  ./surfsense_backend

# === 镜像管理 ===
docker images                           # 查看所有镜像
docker images | grep surfsense          # 查看 SurfSense 镜像
docker rmi surfsense-backend:latest     # 删除镜像
docker image prune                      # 清理悬空镜像
docker image prune -a                   # 清理未使用的镜像

# === 镜像标签和推送 ===
docker tag surfsense-backend:latest your-registry.com/surfsense-backend:v1.0.0
docker push your-registry.com/surfsense-backend:v1.0.0
docker pull ghcr.io/modsetter/surfsense_backend:latest
```

### C. Docker Compose 命令速查

```bash
# 启动
docker-compose up -d                    # 后台启动所有服务
docker-compose up -d backend            # 启动特定服务
docker-compose up --build               # 重新构建并启动

# 停止
docker-compose stop                     # 停止所有服务
docker-compose down                     # 停止并删除容器
docker-compose down -v                  # 停止并删除容器和数据卷

# 重启
docker-compose restart                  # 重启所有服务
docker-compose restart backend          # 重启特定服务

# 日志
docker-compose logs -f                  # 实时查看所有日志
docker-compose logs -f backend          # 查看特定服务日志
docker-compose logs --tail=100 backend  # 查看最近100行

# 执行命令
docker-compose exec backend bash        # 进入容器 shell
docker-compose exec db psql -U postgres # 连接数据库

# 状态查看
docker-compose ps                       # 查看服务状态
docker-compose top                      # 查看进程
docker stats                            # 查看资源使用

# 清理
docker-compose down --rmi all           # 删除容器和镜像
docker system prune                     # 清理未使用资源
docker volume prune                     # 清理未使用数据卷
```

### D. 推荐的系统监控工具

- **Portainer**: Docker 容器管理 UI
- **Grafana + Prometheus**: 性能监控
- **Sentry**: 错误追踪
- **Uptime Kuma**: 服务可用性监控

---

**祝你使用愉快！如有问题，欢迎在 GitHub 提 Issue 或加入 Discord 社区交流。**

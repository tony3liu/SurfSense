# SurfSense 播客生成功能设计文档

> 文档版本: 1.0  
> 创建日期: 2026-01-06  
> 最后更新: 2026-01-06

## 1. 功能概述

SurfSense 提供将文本内容转换为 AI 生成播客的功能。用户可以通过自然语言对话请求生成播客，系统会:
1. 接收用户提供的文本内容
2. 使用 LLM 生成播客对话脚本（双人对谈形式）
3. 使用 TTS 服务将脚本转换为音频
4. 合并音频片段并生成最终 MP3 文件
5. 提供音频播放器和文字稿查看功能

## 2. 系统架构

### 2.1 整体流程

```
用户请求 → Agent Tool → Celery Task → Podcaster Graph → TTS Service → FFmpeg → Database → Frontend
```

### 2.2 组件职责

| 组件 | 位置 | 职责 |
|------|------|------|
| GeneratePodcastToolUI | surfsense_web | 前端 UI 组件，处理播客状态和播放 |
| generate_podcast tool | surfsense_backend | Agent 工具，提交 Celery 任务 |
| generate_content_podcast_task | surfsense_backend | Celery 异步任务入口 |
| Podcaster Graph | surfsense_backend | LangGraph 工作流编排 |
| TTS Service | surfsense_backend | 文本转语音服务 |
| Podcast API Routes | surfsense_backend | 播客管理 REST API |
| Podcast Database Model | surfsense_backend | 播客数据持久化 |

## 3. 核心组件详解

### 3.1 前端架构

#### 3.1.1 播客状态管理 (`surfsense_web/lib/chat/podcast-state.ts`)

```typescript
// 核心功能
- isPodcastGenerating()      // 检查是否正在生成播客
- getActivePodcastTaskId()   // 获取当前任务 ID
- setActivePodcastTaskId()   // 设置任务 ID（开始生成时）
- clearActivePodcastTaskId() // 清除任务 ID（完成/错误时）
- subscribeToPodcastState()  // 订阅状态变化
- looksLikePodcastRequest()  // 检测播客请求模式
```

**检测模式**（正则表达式）:
- `/\bpodcast\b/i` - 包含 "podcast" 单词
- `/\bcreate.*podcast\b/i` - "create podcast"
- `/\bgenerate.*podcast\b/i` - "generate podcast"
- `/\bmake.*podcast\b/i` - "make podcast"
- `/\bturn.*into.*podcast\b/i` - "turn into podcast"
- `/\bpodcast.*about\b/i` - "podcast about"
- `/\bgive.*podcast\b/i` - "give podcast"

#### 3.1.2 播客 UI 组件 (`surfsense_web/components/tool-ui/generate-podcast.tsx`)

**组件结构**:
```
GeneratePodcastToolUI
├── PodcastGeneratingState  // 生成中状态（加载动画）
├── PodcastErrorState       // 错误状态
├── AudioLoadingState       // 音频加载状态
├── PodcastPlayer           // 音频播放器 + 文字稿
└── PodcastTaskPoller       // 任务状态轮询器
```

**状态流转**:
```
tool running → processing → success/error
                    ↓
            PodcastTaskPoller
                    ↓
        polling /task/{id}/status
                    ↓
            success → PodcastPlayer
```

**API 调用**:
- `GET /api/v1/podcasts/{id}/audio` - 获取音频文件
- `GET /api/v1/podcasts/{id}` - 获取播客详情（含文字稿）
- `GET /api/v1/podcasts/task/{task_id}/status` - 轮询任务状态

#### 3.1.3 音频播放器组件 (`surfsense_web/components/tool-ui/audio.tsx`)

**功能**:
- 播放/暂停控制
- 进度条拖拽
- 音量控制 + 静音切换
- 下载音频文件
- 播放进度显示

### 3.2 后端架构

#### 3.2.1 Tool 定义 (`surfsense_backend/app/agents/new_chat/tools/podcast.py`)

**工具签名**:
```python
@tool
async def generate_podcast(
    source_content: str,           # 源文本内容
    podcast_title: str = "SurfSense Podcast",  # 播客标题
    user_prompt: str | None = None,  # 自定义指令
) -> dict
```

**返回结果**:
```typescript
type GeneratePodcastResult = {
    status: "processing" | "already_generating" | "success" | "error",
    task_id?: string,
    podcast_id?: number,
    title?: string,
    transcript_entries?: number,
    message?: string,
    error?: string,
}
```

**防重复机制**:
- 使用 Redis Key: `podcast:active:{search_space_id}`
- 30 分钟过期时间
- 返回 `already_generating` 状态阻止重复请求

#### 3.2.2 Celery 任务 (`surfsense_backend/app/tasks/celery_tasks/podcast_tasks.py`)

**任务函数**: `generate_content_podcast_task`

**参数**:
```python
source_content: str       # 要转换的文本
search_space_id: int      # 搜索空间 ID
podcast_title: str        # 播客标题
user_prompt: str | None   # 用户指令
```

**处理流程**:
1. 创建新的异步数据库会话
2. 配置 Podcaster Graph
3. 执行 Graph 生成播客
4. 保存到数据库
5. 清理 Redis 状态

#### 3.2.3 Podcaster Graph (`surfsense_backend/app/agents/podcaster/`)

**Graph 结构**:
```
__start__
    │
    ▼
create_podcast_transcript  (生成对话脚本)
    │
    ▼
create_merged_podcast_audio (TTS + FFmpeg 合并)
    │
    ▼
__end__
```

**状态定义** (`state.py`):
```python
@dataclass
class State:
    db_session: AsyncSession              # 数据库会话
    source_content: str                   # 源内容
    podcast_transcript: list[PodcastTranscriptEntry] | None
    final_podcast_file_path: str | None   # 最终音频路径

class PodcastTranscriptEntry:
    speaker_id: int       # 0 或 1（两位主持人）
    dialog: str           # 对话文本
```

**配置** (`configuration.py`):
```python
@dataclass
class Configuration:
    podcast_title: str
    search_space_id: int
    user_prompt: str | None = None
```

#### 3.2.4 节点实现 (`nodes.py`)

**节点 1: create_podcast_transcript**
- 使用 LLM 生成对话脚本
- 提示词模板 (`prompts.py`):
  - 两位主持人：Speaker 0（主持）+ Speaker 1（专家）
  - 约 6 分钟时长（约 1000 词）
  - 自然对话风格，包含互动和化学反应
  - 支持 `user_prompt` 自定义风格

**节点 2: create_merged_podcast_audio**
- 流程:
  1. 添加开场白："Welcome to SurfSense Podcast"
  2. 遍历 transcript，为每段对话生成 TTS
  3. 使用 FFmpeg 合并所有音频片段
  4. 输出到 `podcasts/{session_id}_podcast.mp3`
- TTS 支持:
  - `local/kokoro` - 本地 Kokoro TTS
  - `openai/tts-1` - OpenAI TTS
  - `vertex_ai/test` - Google Vertex AI TTS
  - `azure/*` - Azure TTS

**语音映射** (`utils.py`):
```python
# OpenAI
speaker_id → voice
0 → alloy
1 → echo
2 → fable
3 → onyx
4 → nova
5 → shimmer

# Vertex AI
0 → en-US-Studio-O
1 → en-US-Studio-M
2 → en-UK-Studio-A
...

# Kokoro
0 → am_adam
1 → af_bella
```

#### 3.2.5 TTS 服务 (`surfsense_backend/app/services/kokoro_tts_service.py`)

**KokoroTTSService**:
- 语言支持: `a`(美式英语), `b`(英式英语), `e`(西班牙语), `f`(法语), 等
- 采样率: 24kHz
- 输出格式: WAV 文件

**配置项** (`config/__init__.py`):
```python
TTS_SERVICE = os.getenv("TTS_SERVICE")           # TTS 提供商
TTS_SERVICE_API_BASE = os.getenv("TTS_SERVICE_API_BASE")  # API Base URL
TTS_SERVICE_API_KEY = os.getenv("TTS_SERVICE_API_KEY")    # API Key
```

### 3.3 API 路由 (`routes/podcasts_routes.py`)

| 方法 | 端点 | 功能 | 权限 |
|------|------|------|------|
| GET | `/podcasts` | 列出播客 | PODCASTS_READ |
| GET | `/podcasts/{id}` | 获取播客详情 | PODCASTS_READ |
| DELETE | `/podcasts/{id}` | 删除播客 | PODCASTS_DELETE |
| GET | `/podcasts/{id}/audio` | 流式传输音频 | PODCASTS_READ |
| GET | `/podcasts/{id}/stream` | 流式传输音频（别名） | PODCASTS_READ |
| GET | `/podcasts/task/{task_id}/status` | 查询任务状态 | 认证用户 |

### 3.4 数据库模型 (`db.py`)

```python
class Podcast(BaseModel, TimestampMixin):
    __tablename__ = "podcasts"

    title: str                              # 播客标题
    podcast_transcript: list[dict] | None   # 文字稿（JSON）
    file_location: str | None               # 音频文件路径
    search_space_id: int                    # 所属搜索空间

    # 关系
    search_space = relationship("SearchSpace", back_populates="podcasts")
```

**权限控制**:
- `PODCASTS_CREATE` - 创建播客
- `PODCASTS_READ` - 读取播客/音频
- `PODCASTS_UPDATE` - 更新播客
- `PODCASTS_DELETE` - 删除播客

## 4. 数据流

### 4.1 播客生成请求流程

```
1. 用户: "Create a podcast about this document"
2. Agent 检测到播客请求
3. 调用 generate_podcast tool
4. Tool 检查 Redis 锁
   ├─ 已存在任务 → 返回 "already_generating"
   └─ 无任务 → 继续
5. 提交 Celery 任务
6. 设置 Redis 锁: podcast:active:{search_space_id}
7. 返回 task_id 给前端
8. 前端开始轮询 /task/{id}/status
9. Celery 执行:
   a. 创建 db session
   b. 运行 Podcaster Graph
   c. 保存 Podcast 到数据库
   d. 清理 Redis 锁
10. 轮询返回 success + podcast_id
11. 前端获取音频并播放
```

### 4.2 文件结构

```
surfsense_backend/
├── app/
│   ├── agents/
│   │   └── podcaster/           # 播客生成 agent
│   │       ├── __init__.py
│   │       ├── configuration.py # 配置
│   │       ├── graph.py         # LangGraph 定义
│   │       ├── nodes.py         # 节点实现
│   │       ├── prompts.py       # LLM 提示词
│   │       ├── state.py         # 状态定义
│   │       └── utils.py         # 工具函数
│   ├── routes/
│   │   └── podcasts_routes.py   # API 路由
│   ├── schemas/
│   │   └── podcasts.py          # Pydantic schemas
│   ├── services/
│   │   └── kokoro_tts_service.py # TTS 服务
│   ├── tasks/
│   │   └── celery_tasks/
│   │       └── podcast_tasks.py  # Celery 任务
│   └── db.py                     # 数据库模型

surfsense_web/
├── app/
│   └── dashboard/
│       └── [search_space_id]/
│           └── new-chat/
│               └── [[...chat_id]]/
│                   └── page.tsx  # 聊天页面集成
├── components/
│   └── tool-ui/
│       ├── generate-podcast.tsx # 播客 UI
│       └── audio.tsx            # 音频播放器
└── lib/
    └── chat/
        └── podcast-state.ts     # 状态管理
```

## 5. 配置项

### 5.1 环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `TTS_SERVICE` | TTS 提供商 | `local/kokoro`, `openai/tts-1` |
| `TTS_SERVICE_API_BASE` | API 基础 URL | `https://api.openai.com/v1` |
| `TTS_SERVICE_API_KEY` | API 密钥 | sk-... |
| `CELERY_BROKER_URL` | Celery Redis URL | `redis://localhost:6379/0` |

### 5.2 播客生成参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `podcast_title` | "SurfSense Podcast" | 播客标题 |
| `user_prompt` | None | 自定义风格指令 |
| `TTS_SERVICE` | - | TTS 提供商 |
| `speed` | 1.0 | 语速 |

## 6. 依赖组件

### 6.1 Python 依赖

```txt
langgraph           # 工作流编排
langchain-core      # 消息和工具
celery              # 异步任务
redis               # 状态锁
sqlalchemy          # 数据库
kokoro              # 本地 TTS
soundfile           # 音频处理
ffmpeg              # 音频合并
litellm             # LLM/TTS 统一接口
```

### 6.2 系统依赖

- **FFmpeg** - 音频合并（通过 `static_ffmpeg` 自动安装）

## 7. 改造建议

### 7.1 潜在改进点

1. **多语言支持**
   - 当前主要支持英语（`lang_code="a"`）
   - 可扩展 `get_podcast_generation_prompt` 支持多语言

2. **播客长度控制**
   - 当前固定约 6 分钟
   - 可添加参数控制生成时长

3. **语音选择**
   - 当前固定两位主持人
   - 可添加多 voice 选项

4. **进度反馈**
   - 当前仅显示"生成中"
   - 可添加详细进度（脚本生成中 → TTS 生成中 → 合并中）

5. **错误处理**
   - TTS 失败时重试机制
   - 部分成功时返回已生成片段

6. **存储优化**
   - 临时文件清理时机
   - 播客文件可考虑云存储

### 7.2 扩展方向

1. **播客列表页面**
   - 当前仅在聊天中显示
   - 可添加专门的播客管理页面

2. **播客编辑**
   - 当前不可编辑
   - 可支持修改文字稿后重新生成

3. **批量生成**
   - 当前单次一个播客
   - 可支持批量内容生成多个播客

4. **播客分享**
   - 当前无分享功能
   - 可添加公开链接分享

## 8. 相关文件索引

| 文件路径 | 功能 |
|----------|------|
| `surfsense_web/lib/chat/podcast-state.ts` | 前端状态管理 |
| `surfsense_web/components/tool-ui/generate-podcast.tsx` | 播客 UI 组件 |
| `surfsense_web/components/tool-ui/audio.tsx` | 音频播放器 |
| `surfsense_backend/app/agents/new_chat/tools/podcast.py` | Agent 工具 |
| `surfsense_backend/app/agents/new_chat/tools/registry.py` | 工具注册 |
| `surfsense_backend/app/tasks/celery_tasks/podcast_tasks.py` | Celery 任务 |
| `surfsense_backend/app/agents/podcaster/graph.py` | Graph 定义 |
| `surfsense_backend/app/agents/podcaster/nodes.py` | Graph 节点 |
| `surfsense_backend/app/agents/podcaster/prompts.py` | LLM 提示词 |
| `surfsense_backend/app/agents/podcaster/state.py` | 状态定义 |
| `surfsense_backend/app/agents/podcaster/utils.py` | 语音映射 |
| `surfsense_backend/app/routes/podcasts_routes.py` | API 路由 |
| `surfsense_backend/app/schemas/podcasts.py` | API Schemas |
| `surfsense_backend/app/services/kokoro_tts_service.py` | TTS 服务 |
| `surfsense_backend/app/db.py` | 数据库模型 |
| `surfsense_backend/app/config/__init__.py` | 配置 |

## 9. 测试验证

### 9.1 功能测试

```bash
# 启动后端
cd surfsense_backend && python -m uvicorn app.app:app --reload

# 启动 Celery Worker
cd surfsense_backend && celery -A app.celery_app worker -l info

# 启动前端
cd surfsense_web && pnpm dev
```

### 9.2 测试命令

```
# 触发播客生成
"Create a podcast about quantum computing"

# 预期行为
1. 显示生成中状态
2. 5秒后查询任务状态
3. 任务完成后显示音频播放器
4. 可播放和下载音频
```

## 10. 常见问题

### Q: 播客生成需要多长时间?
A: 通常 1-3 分钟，取决于内容长度和 TTS 服务响应速度。

### Q: 如何更改播客风格?
A: 通过 `user_prompt` 参数，如 "Make it casual and fun"。

### Q: 支持哪些 TTS 服务?
A: OpenAI TTS-1、Vertex AI、Azure、本地 Kokoro。

### Q: 播客文件存储在哪里?
A: `podcasts/{session_id}_podcast.mp3`，建议使用云存储优化。

### Q: 可以生成多长的播客?
A: 当前约 6 分钟（1000 词），可通过修改 prompt 调整。

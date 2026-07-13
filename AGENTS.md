# ima2-gen — AI 上下文说明

## 项目功能

本地 AI 图像生成工作室（v2.x）——提供 CLI 和 Web UI。

* 支持多种服务提供方：

  * GPT OAuth
  * API Key
  * Grok
  * Gemini API
  * Antigravity CLI
* 支持文生图、图生图（图像编辑）以及视频生成
* SSE 多路复用架构：

  * 使用单一的 `GET /api/events` SSE 通道
  * 配合异步 POST 请求（返回 HTTP 202）
* 支持并行生成：

  * 最多同时执行 12 个生成任务
  * 不会占满浏览器连接数

## 技术栈

* 运行环境：Node.js >= 20，使用 ES Module
* 服务端：Express 5
* API 客户端：OpenAI SDK v5
* OAuth：`openai-oauth`，作为 ChatGPT 会话代理
* Grok：内置 `progrok`，调用 xAI Images API
* Gemini：

  * Google Generative Language API
  * Vertex AI
* 前端：React + Vite

  * 源码目录：`ui/src`
  * 构建输出目录：`ui/dist`
* SSE：

  * `lib/eventBus.ts`：基于环形缓冲区的发布/订阅机制
  * `routes/events.ts`：SSE 事件路由

## 项目结构

```text
ima2-gen/
├── bin/                     # CLI 入口及子命令
├── server.ts                # Express 启动入口及静态 UI 服务
├── config.ts                # 运行时配置
├── routes/                  # API 路由模块，源码为 *.ts
│   ├── events.ts            # GET /api/events，SSE 多路复用
│   ├── multimode.ts         # 多模式批量生成：异步 POST + 双通道事件发送
│   ├── nodes.ts             # 节点模式：异步 POST + 双通道事件发送
│   ├── video.ts             # 视频生成：异步 POST + 双通道事件发送
│   └── ...                  # generate、edit、sessions、history 等
├── lib/                     # 服务端辅助模块，源码为 *.ts
│   ├── eventBus.ts          # 全局发布/订阅环形缓冲区，最多保存 2000 个事件
│   ├── ssePublish.ts        # 防止取消事件与完成事件发生竞态冲突
│   ├── inflight.ts          # 任务生命周期追踪
│   └── ...                  # OAuth、存储、会话等功能
├── ui/src/                  # React/Vite 应用源码
│   ├── lib/eventChannel.ts  # `/api/events` 的单例 EventSource
│   ├── lib/sseStreamError.ts # SSE 错误解析器
│   └── store/store*Impl.ts  # 模块化 Zustand 状态切片
├── ui/dist/                 # 前端构建产物，由 server.js 提供服务
├── site/                    # Astro 营销及文档网站，部署于 GitHub Pages
├── integrations/comfyui/    # ComfyUI 桥接及自定义节点
├── structure/               # 当前架构参考文档，编号 00～07
├── devlog/                  # `_plan` 为进行中计划，`_fin` 为已归档计划
├── tests/                   # 基于 node:test 的契约测试与回归测试，共 1094 个用例
└── package.json
```

## Agent Skills

项目在 `skills/` 中提供以下 AI 编码技能：

| 技能 | 路径 | CLI | 覆盖范围 |
|------|------|-----|----------|
| Core | `skills/ima2/SKILL.md` | `ima2 skill` | CLI、提示词协议、服务商路由与视频工作流 |
| Frontend | `skills/ima2-front/SKILL.md` | `ima2 skill front` | 资源管线、动效/视频、响应式、无障碍与视觉规范 |
| UI/UX | `skills/ima2-uiux/SKILL.md` | `ima2 skill uiux` | 视觉探索、UX 状态与产品设计模式 |

使用 `ima2 skill ls` 查看技能，使用 `ima2 skill <name> path` 获取路径。`front` 与 `uiux` 的参考模块可按需加载：

```bash
ima2 skill front refs
ima2 skill front ref anti-slop
ima2 skill uiux ref design-isms
ima2 skill install --dir <path>
ima2 skill install --tmp
```

## Devlog 阶段路线图

* 当前进行中的计划存放在 `devlog/_plan/`。
* 已完成的计划存放在 `devlog/_fin/`。
* 旧版阶段文档存放在 `devlog/_plan/_legacy/`。
* 当前路线图以以下文件为准：

  * `structure/07-devlog-map.md`
  * `devlog/_plan/README.md`

## 开发约定

* 只使用 ES Module，即 `import/export`
* 单个文件长度必须小于 500 行，超过后需要拆分
* 单个函数长度必须小于 50 行
* 所有异步操作必须使用 `try/catch`
* 配置项必须放在 `config.js` 或 `.env` 中，禁止硬编码

## 测试命令

```bash
npm run typecheck          # 执行 tsc --noEmit，检查 server 和 lib
npm run typecheck:tests    # 执行 tsc --noEmit，检查测试文件
npm test                   # 执行 node:test，共 1094 个用例
npm run test:inventory     # 验证测试文件注册清单
cd ui && npm run build     # 执行 Vite 生产环境构建
```

## 心跳检查机制

* 每隔 20 分钟检查一次 `devlog/_plan`，并提出下一步工作建议
* 已完成的阶段需要移动到 `_fin/` 目录，并添加 `YYMMDD_` 日期前缀

## 编码规则

* 前后端代码必须有中文注释，前端要做到属性、函数、TSX 元素注释。后端要做到属性、函数、结构体、枚举等注释。对于前后端的函数处理，要添加行内注释。
* 输出的代码和注释等必须使用 UTF-8（无 BOM）编码。

**检索策略**：

* 禁止基于假设 (Assumption) 回答
* 使用自然语言构建语义查询 (Where/What/How)
* 完整性检查：必须获取相关类、函数、变量的完整定义与签名
* 若上下文不足，触发递归检索直至信息完整

**需求对齐**：若检索后需求仍有模糊空间，必须向用户输出引导性问题列表，直至需求边界清晰（无遗漏、无冗余）。

## GIT规则

用户要求提交代码时，仅根据修改内容生成中文 commit message（带类型和作用域的格式）。

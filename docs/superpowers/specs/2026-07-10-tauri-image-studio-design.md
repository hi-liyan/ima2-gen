# Tauri Image Studio Design

## Goal

在现有 `ima2-gen` 仓库中新增独立的 Tauri 2 桌面端应用。首版通过可配置的 OpenAI 兼容第三方供应商，以提示词和可选参考图生成图片。它不依赖、不启动，也不修改现有 Node 服务或 Node 工作流。

首版提供供应商配置、远程模型列表、图片生成、本地历史画廊和完整元数据回溯。视频、Node 模式、画布编辑、OAuth 和多供应商预设不在范围内。

## Architecture

新增顶层 `desktop/` 目录：

- `desktop/src/`：React、TypeScript 和 Tailwind CSS 前端。
- `desktop/src-tauri/`：Tauri 2 Rust 后端。
- `desktop/src-tauri/src/config.rs`：配置读写和掩码视图。
- `desktop/src-tauri/src/provider.rs`：OpenAI 兼容模型与生图适配器。
- `desktop/src-tauri/src/library.rs`：图片、参考图与历史元数据持久化。
- `desktop/src-tauri/src/commands.rs`：暴露给 WebView 的最小 Tauri command 集合。

Rust 后端是唯一持有 API Key 和访问网络、文件系统的位置。React 仅向 Tauri command 传递用户输入与文件选择结果。前端不得发起供应商 HTTP 请求、保存 API Key 或在日志中输出敏感配置。

依赖采用 `async-openai` 和 `reqwest`，不引入 `autoagents` 或 Agent 框架。`async-openai` 提供自定义 Base URL、OpenAI Images 与 Responses 端点能力；`reqwest` 用于下载 URL 类型图片与处理供应商兼容响应。供应商方言留在 `provider.rs`，不会扩散至命令或 React 层。

## Provider Contract

配置文件保存在 Tauri 应用数据目录的 `config.json`，包含：

- 供应商显示名称。
- Base URL。
- API Key。
- 生图协议优先级：`images-first` 或 `responses-first`。
- 最后选择的模型、尺寸、输出格式和数量。
- 可选的参考图字段名称覆盖。

API Key 只在保存时写入该文件；读取配置返回给 UI 时始终为掩码值。程序日志、错误响应、历史文件和诊断信息都不得含 API Key、Authorization Header 或完整图片 Base64。

模型刷新调用 `GET /models`，将响应的模型 ID 映射为可选择列表。网络或解析失败时保留上次成功列表及当前模型选择，并返回可读错误。

生成请求先调用配置优先级对应的端点：

1. Images 使用 `POST /images/generations`；有参考图时优先使用标准的 `POST /images/edits` multipart 请求。
2. Responses 使用 `POST /responses` 与 `image_generation` 工具。
3. 仅当响应表明端点、能力或请求形状不受支持时，才调用另一个协议。鉴权失败、限额、内容审核、超时和服务端错误不得触发回退，以免重复收费。

适配器统一处理 Base64 与远程 URL 图片。每张结果必须先完整保存至本地，之后才进入历史记录与前端展示。

## Persistence And History

应用数据目录包含：

```text
config.json
history.json
images/<generation-id>.<extension>
references/<generation-id>-<index>.<extension>
```

每一张生成图片拥有独立、不可变的历史记录，字段包括：ID、图片路径、提示词、供应商名称、Base URL、模型、尺寸、输出格式、数量、实际协议、参考图副本路径、创建时间、响应内可安全保存的用量与修订提示词。完整原始响应、API Key、请求头和图片 Base64 不保存。

参考图在发起请求前复制至 `references/`，所以用户移动或删除原始文件后历史仍可复用。历史详情允许把所有保存参数和提示词回填到创作表单。图片操作包括下载至用户选择的位置，以及通过系统文件管理器打开图片所在目录。

## UI And Interaction

桌面端使用固定左侧图标导航，页面为创作、历史画廊和供应商设置：

- 创作页是三栏工作区：提示词和参考图、结果画布、生成参数。参数包含模型、尺寸、输出格式与图片数量。生成中显示明确进度并可取消。
- 历史页是无嵌套卡片的缩略图网格；选择项后在单层右侧详情面板显示图片、提示词、完整元数据以及复用、下载、打开目录命令。
- 设置页编辑供应商配置、保存掩码 API Key、刷新模型列表和选择协议优先级。

界面使用深石墨背景、冷灰分隔线、青绿色命令强调、低对比网格纹理和细发光边缘。禁止渐变色；页面区域不作为浮动卡片；卡片只用于缩略图项与必要模态框，并使用不超过 8px 的圆角。所有图标按钮带提示文本，布局需在常见桌面窗口宽度下保持稳定。

首次未配置、模型加载中、生成中、取消、空模型列表、空画廊、供应商网络错误和本地保存失败均有明确状态。错误消息向用户显示可操作原因，同时保留不含敏感数据的端点、HTTP 状态和供应商错误码。

## Tauri Commands

- `get_provider_config`：返回掩码后的配置及最后使用选项。
- `save_provider_config`：验证并持久化供应商配置。
- `list_models`：从当前配置刷新模型列表。
- `choose_reference_images`：通过原生文件选择器返回参考图文件信息。
- `generate_image`：验证输入、复制参考图、调用适配器、保存结果并返回新历史项。
- `cancel_generation`：取消当前生成任务。
- `list_history`：按时间倒序返回历史摘要。
- `get_history_item`：返回单项完整元数据。
- `reveal_image`：在系统文件管理器中定位图片。
- `export_image`：将本地图片复制到用户选择的位置。

## Testing

Rust 单元与集成测试覆盖配置掩码和持久化、模型列表解析、协议回退判定、Base64 与 URL 图片落盘、参考图副本、历史快照及复用回填、错误映射和敏感字段排除。网络测试使用本地模拟 HTTP 服务，不访问真实供应商。

前端测试覆盖 command 参数构造、初始配置状态、模型刷新、生成与取消状态、错误展示、历史详情和元数据回填。构建验证包括 TypeScript 检查、Vite 生产构建与 `cargo check`；完成前执行 Rust 与前端测试套件。

## Acceptance Criteria

- 用户可配置一个 OpenAI 兼容 Base URL 与 API Key，刷新并选择远程模型。
- 用户可提交提示词、可选参考图、模型、尺寸、格式和数量生成图片。
- Images 与 Responses 均可按明确不支持条件回退，其他失败不会重试另一端点。
- 每个结果图片和全部安全元数据均可在重启后从本地画廊查看与复用。
- 每张图片可下载和在系统文件管理器中定位。
- API Key、授权头、完整 Base64 和完整原始响应不会展示或持久化。
- 界面符合无渐变、无多层卡片嵌套的桌面端 AI 科技风格。

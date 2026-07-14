# Electron Desktop Shell Design

## Goal

在保留 `ima2` CLI 与浏览器访问方式的前提下，为 ima2-gen 增加 Electron
桌面启动入口。桌面窗口使用现有 Express 服务提供的 UI、API、SSE 和生成文件，
不复制或改写既有业务逻辑。

## Scope

首版交付未签名的 Windows x64、macOS arm64 和 macOS x64 安装产物。不包含
代码签名、Apple notarization、自动更新、托盘常驻、开机启动或新的 renderer UI。

## Architecture

Electron 主进程直接导入现有 `startServer()`。服务依然绑定回环地址，并保留
现有端口回退、配置、SSE、OAuth/Grok 代理、数据库及生成目录逻辑。主进程在
健康检查成功后创建 `BrowserWindow`，窗口加载服务实际监听的
`http://127.0.0.1:<port>` 地址。

渲染进程因此保持同源：现有相对 `/api/*` 请求、`/api/events` EventSource、
`/generated/*` 静态资源和 React UI 都无需变更。浏览器访问和 CLI 继续独立通过
既有 `ima2 serve` 路径工作。

Electron 主进程退出时调用服务提供的关闭路径，停止 HTTP 服务、OAuth/Grok
子进程、后台 worker 和数据库连接。服务启动失败时不创建业务窗口，而是展示一个
最小原生错误窗口并将诊断写至标准错误输出。

## Packaging

新增 `desktop/` 作为桌面启动代码目录。根 `package.json` 增加 Electron、
electron-builder 和桌面构建脚本，但保留原有 npm CLI 发布脚本和 `files` 清单。

Electron 发行构建先运行现有 UI、服务端和 CLI 编译，再编译主进程。首版禁用
ASAR，使 Express 静态文件与 `sharp`、`better-sqlite3` 等原生 Node 模块按普通
文件系统路径加载。electron-builder 在各自平台构建 NSIS（Windows）以及
DMG/ZIP（macOS）产物。

因为 Electron 自带 Node 运行时，桌面用户不需要预装 Node.js。Windows 和 macOS
产物必须在匹配系统及架构的 CI runner 上构建，确保原生依赖与 Electron ABI 匹配。

## Modules

- `desktop/runtime.ts`：纯 Node 模块，负责服务 URL 标准化、轮询健康检查和超时
  错误；可在 `node:test` 中直接验证。
- `desktop/main.ts`：Electron 生命周期、启动现有 Express 服务、创建窗口和退出
  清理；只协调 Electron 与 `desktop/runtime.ts`，不承载业务逻辑。
- `tests/desktop-runtime.test.ts`：服务就绪、超时、URL 规范化等真实 HTTP 契约。
- `tests/desktop-package-contract.test.js`：验证脚本、打包目标和 ASAR 策略，防止
  发布配置被无意移除。

## Error Handling And Security

服务仅监听现有默认回环地址，窗口也只导航到由主进程获取的回环 URL。渲染进程禁用
Node integration，启用 context isolation；首版不向 renderer 暴露 Electron IPC API。
窗口导航和新窗口请求仅允许该服务 origin，外部链接使用系统浏览器打开。

健康检查在有限时间内重试。服务提前退出、返回非成功状态或超时时，启动过程应报告
明确错误并执行服务清理。正常退出和启动失败都必须是幂等的，避免遗留 OAuth/Grok
子进程或锁定数据库。

## Verification

实现遵循测试优先：先为 `desktop/runtime.ts` 写失败的 Node 测试，再添加最小实现。
桌面配置契约测试应验证 Windows x64、macOS x64、macOS arm64 目标及 ASAR 关闭。

在当前 Windows 环境至少执行桌面运行时测试、桌面配置契约测试、`npm run typecheck`、
`npm run typecheck:tests`、`npm run ui:build` 和 Windows Electron 打包。macOS 安装
产物在 macOS runner 上构建；未签名产物的 Gatekeeper 限制作为发布说明明确告知。

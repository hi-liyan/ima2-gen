# Electron 原生依赖与窗口诊断设计

## 目标

让 Electron 42 能稳定加载 `better-sqlite3`，并在桌面窗口无法展示或渲染失败时提供可定位的日志。

## 方案

- 将 `better-sqlite3` 升级并锁定到 `12.11.1`，同步 npm 安装脚本审批。
- 将 `@electron/rebuild` 作为直接开发依赖，并在 `desktop/node_modules` 中维护隔离的 Electron 原生依赖。
- 新增 Electron 冒烟入口：加载 `better-sqlite3`，执行内存 SQLite 查询并以退出码表达结果。
- `desktop:dev` 和 `desktop:dist` 在构建后依次安装隔离依赖、重建隔离原生模块并执行冒烟验证。
- 在主进程中，于 `loadURL()` 前注册 `ready-to-show`，并记录主框架加载失败及渲染进程退出事件。

## 边界与限制

同一个 `better_sqlite3.node` 只能匹配一种 ABI。根 `node_modules` 始终供普通 Node 使用；Electron 仅通过运行时绑定加载器使用 `desktop/node_modules` 中的副本。electron-builder 禁用根目录原生模块自动重建，避免打包流程污染普通 Node 依赖。本次不改变服务架构或浏览器端行为。

## 验证

桌面配置契约测试验证依赖、脚本和窗口事件顺序；Electron 冒烟入口验证真实原生模块加载。类型检查、桌面脚本和现有测试用于确认没有回归。

import { app, BrowserWindow, dialog, shell } from "electron";
import { startServer } from "../server.js";
import { loopbackUrl, waitForHealthyServer } from "./runtime.js";

/** 当前 Electron 会话启动的后端服务，退出前必须释放。 */
let started: Awaited<ReturnType<typeof startServer>> | null = null;
/** 通过健康检查后的唯一允许导航来源。 */
let serverOrigin = "";

/**
 * 判断导航地址是否仍属于当前本地服务。
 */
function isServerNavigation(url: string): boolean {
  try {
    return loopbackUrl(url) === serverOrigin;
  } catch {
    return false;
  }
}

/**
 * 创建受限的业务窗口，界面继续由 Express 提供。
 */
async function createMainWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!isServerNavigation(url)) event.preventDefault();
  });
  await window.loadURL(serverOrigin);
  window.once("ready-to-show", () => window.show());
}

/**
 * 按既有服务流程启动后端，成功后才显示桌面窗口。
 */
async function boot() {
  started = await startServer();
  serverOrigin = await waitForHealthyServer(started.ctx.serverUrl);
  await createMainWindow();
}

app.whenReady().then(boot).catch(async (error: unknown) => {
  console.error("[desktop] startup failed", error);
  await started?.close();
  await dialog.showMessageBox({
    type: "error",
    title: "ima2-gen",
    message: "Desktop service failed to start",
    detail: error instanceof Error ? error.message : String(error),
  });
  app.quit();
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", (event) => {
  if (!started) return;
  event.preventDefault();
  const closing = started;
  started = null;
  void closing.close().finally(() => app.quit());
});

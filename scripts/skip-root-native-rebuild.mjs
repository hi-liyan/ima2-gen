// Electron 的原生模块位于 desktop/node_modules，根依赖只供普通 Node 使用。
export default function skipRootNativeRebuild() {
  return false;
}

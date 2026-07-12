import { runGeneratePipeline } from "../lib/generatePipeline.js";
import { requireRuntimeContext } from "../lib/runtimeContext.js";
export function registerGenerateRoutes(app, ctxRaw) {
    const ctx = requireRuntimeContext(ctxRaw);
    app.post("/api/generate", (req, res) => runGeneratePipeline(req, res, ctx));
}

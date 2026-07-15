import { runGeneratePipeline } from "../lib/generatePipeline.js";
import { requireRuntimeContext } from "../lib/runtimeContext.js";
import { normalizePresetIds } from "../lib/presetCompiler.js";
export function registerGenerateRoutes(app, ctxRaw) {
    const ctx = requireRuntimeContext(ctxRaw);
    app.post("/api/generate", (req, res) => {
        req.body = { ...req.body, presetIds: normalizePresetIds(req.body?.presetIds) };
        return runGeneratePipeline(req, res, ctx);
    });
}

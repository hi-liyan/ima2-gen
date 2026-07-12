import { listGenerationRequestLog } from "../lib/generationRequestLog.js";
import { requireRuntimeContext } from "../lib/runtimeContext.js";
export function registerGenerationRequestLogRoutes(app, ctxRaw) {
    const ctx = requireRuntimeContext(ctxRaw);
    app.get("/api/generation-requests", async (_req, res) => {
        try {
            const items = await listGenerationRequestLog(ctx.config.storage.generationRequestLogFile);
            res.json({ items });
        }
        catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : "Could not read generation request log",
            });
        }
    });
}

import type { Express } from "express";
import { runGeneratePipeline } from "../lib/generatePipeline.js";
import { requireRuntimeContext, type RouteRuntimeContext } from "../lib/runtimeContext.js";

export function registerGenerateRoutes(app: Express, ctxRaw: RouteRuntimeContext) {
  const ctx = requireRuntimeContext(ctxRaw);
  app.post("/api/generate", (req, res) => runGeneratePipeline(req, res, ctx));
}



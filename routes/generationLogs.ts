import type { Express, Request, Response } from "express";
import {
  clearGenerationLogs,
  getGenerationLog,
  listGenerationLogs,
} from "../lib/generationLogStore.js";

function parseLimit(value: unknown): number {
  const limit = Number(value);
  return Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 200)) : 50;
}

export function registerGenerationLogRoutes(app: Express) {
  app.get("/api/generation-logs", (req: Request, res: Response) => {
    res.json({ logs: listGenerationLogs(parseLimit(req.query.limit)) });
  });

  app.get("/api/generation-logs/:requestId", (req: Request<{ requestId: string }>, res: Response) => {
    const log = getGenerationLog(req.params.requestId);
    if (!log) return res.status(404).json({ error: "Generation log not found", code: "GENERATION_LOG_NOT_FOUND" });
    return res.json({ log });
  });

  app.delete("/api/generation-logs", (_req: Request, res: Response) => {
    res.json({ deleted: clearGenerationLogs() });
  });
}

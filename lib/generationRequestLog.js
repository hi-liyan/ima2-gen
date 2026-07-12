import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { atomicWriteJson } from "./atomicWrite.js";
const MAX_ENTRIES = 200;
let writeQueue = Promise.resolve();
async function readEntries(path) {
    try {
        const parsed = JSON.parse(await readFile(path, "utf8"));
        return Array.isArray(parsed) ? parsed.slice(0, MAX_ENTRIES) : [];
    }
    catch {
        return [];
    }
}
export async function listGenerationRequestLog(path) {
    return readEntries(path);
}
export function appendGenerationRequestLog(path, entry) {
    writeQueue = writeQueue.catch(() => undefined).then(async () => {
        await mkdir(dirname(path), { recursive: true });
        const entries = await readEntries(path);
        await atomicWriteJson(path, [entry, ...entries].slice(0, MAX_ENTRIES));
    });
    return writeQueue;
}

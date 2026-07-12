import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
const requireFromPackage = createRequire(import.meta.url);
function readManifest(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}
function resolvePackageManifest(packageName) {
    try {
        return requireFromPackage.resolve(`${packageName}/package.json`);
    }
    catch (error) {
        if (error.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED")
            throw error;
    }
    let current = dirname(requireFromPackage.resolve(packageName));
    while (true) {
        const candidate = join(current, "package.json");
        if (existsSync(candidate) && readManifest(candidate).name === packageName)
            return candidate;
        const parent = dirname(current);
        if (parent === current)
            throw new Error(`Could not locate ${packageName}/package.json`);
        current = parent;
    }
}
export function resolvePackageBin(packageName, binName) {
    const manifestPath = resolvePackageManifest(packageName);
    const manifest = readManifest(manifestPath);
    const entry = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.[binName];
    if (!entry)
        throw new Error(`${packageName} does not declare the ${binName} CLI`);
    const binPath = resolve(dirname(manifestPath), entry);
    if (!existsSync(binPath))
        throw new Error(`${packageName} CLI entry is missing: ${binPath}`);
    return binPath;
}
export function packageCliCommand(packageName, binName, args = [], options = {}) {
    return {
        command: options.execPath || process.execPath,
        args: [resolvePackageBin(packageName, binName), ...args],
    };
}

import { $, inspect } from "bun"
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";

export type ModuleInfo =
    & Record<"kind" | "local" | "mediaType" | "specifier", string>
    & Record<"emit" | "map", string | null>
    & {
        dependencies?: unknown[];
        size: number;
    };

export type DependencyInspectorResult = {
    modules: ModuleInfo[];
    roots: string[];
};

export function getDenoDir(): string {
    // ref https://deno.land/manual.html
    // On Linux/Redox: $XDG_CACHE_HOME/deno or $HOME/.cache/deno
    // On Windows: %LOCALAPPDATA%/deno (%LOCALAPPDATA% = FOLDERID_LocalAppData)
    // On macOS: $HOME/Library/Caches/deno
    // If something fails, it falls back to $HOME/.deno
    let denoDir = process.env.DENO_DIR;
    if (denoDir === undefined) {
        switch (process.platform) {
            case "win32":
                denoDir = `${process.env.LOCALAPPDATA}\\deno`;
                break;
            case "darwin":
                denoDir = `${process.env.HOME}/Library/Caches/deno`;
                break;
            case "linux":
                denoDir = process.env.XDG_CACHE_HOME
                    ? `${process.env.XDG_CACHE_HOME}/deno`
                    : `${process.env.HOME}/.cache/deno`;
                break;
            default:
                denoDir = `${process.env.HOME}/.deno`;
        }
    }

    return denoDir;
}

export function getDenoRemoteDir(): string {
    return path.join(getDenoDir(), "remote");
}

export function getDenoInfo() {
    return $`deno info --json`.json();
}

export function isInDenoDir(filepath: string): boolean {
    filepath = normalizeFilepath(filepath);
    const denoDir = getDenoDir();
    return filepath.startsWith(denoDir);
}

export function getPluginPath(): string {
    return path.resolve(import.meta.dirname, "..");
}

export function getDenoDtsPath(
    specifier: string,
): string | undefined {
    let file: string = path.resolve(getDenoDir(), specifier);

    if (fs.existsSync(file)) {
        return file;
    }

    file = path.resolve(getPluginPath(), "lib", specifier);
    if (fs.existsSync(file)) {
        return file;
    }

    return undefined;
}


export function normalizeFilepath(filepath: string): string {
    return path.normalize(
        filepath
            // in Windows, filepath maybe `c:\foo\bar` tut the legal path should be `C:\foo\bar`
            .replace(/^([a-z]):\\/, (_, $1) => $1.toUpperCase() + ":\\")
            // There are some paths which are unix style, this style does not work on win32 systems
            .replace(/\//gm, path.sep),
    );
}

export function pathExistsSync(filepath: string): boolean {
    try {
        fs.statSync(filepath);
        return true;
    } catch {
        return false;
    }
}

export function hashURL(url: URL): string {
    return crypto
        .createHash("sha256")
        .update(url.pathname + url.search)
        .digest("hex");
}

export function resolveImport(specifier: string | URL) {
    specifier = String(specifier)
    const url = new URL(specifier);
    const originDir = path.join(
        getDenoRemoteDir(),
        url.protocol.replace(/:$/, ""), // https: -> https
        `${url.hostname}${url.port ? `_PORT${url.port}` : ""}`, // hostname.xyz:3000 -> hostname.xyz_PORT3000
    );
    const hash = hashURL(url);
    const metaFilePath = path.resolve(originDir, `${hash}.metadata.json`);
    const moduleFilePath = path.resolve(originDir, hash)

    return {
        specifier,
        hash,
        originDir,
        moduleFilePath,
        metaFilePath
    }
}

export async function getInfo(specifier: string | URL): Promise<ModuleInfo | undefined> {
    const result = await $`deno info --json ${specifier}`.json() as DependencyInspectorResult

    return result.modules.find((info) => info.specifier === specifier);
}

export async function getLocal(specifier: string | URL) {
    const info = await getInfo(specifier);

    return info?.local;
}

export function log(value: unknown): void {
    const inspectOpts: Deno.InspectOptions = {
        colors: true,
        depth: Infinity,
        strAbbreviateSize: Infinity,
    };

    const formattedOutput = inspect(value, inspectOpts);
    console.log(formattedOutput);
}
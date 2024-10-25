import { $, type BunPlugin } from "bun";
import { getDenoRemoteDir, hashURL, pathExistsSync, resolveImport } from "./utils.ts";
import { join, resolve as resolvePath } from "node:path";

// Regexes
const rx_any = /./;
const rx_http = /^https?:\/\//;
const rx_relative_path = /^\.\.?\//;
// const rx_absolute_path = /^\//;

export const plugin: BunPlugin = {
    name: "debun-plugin",
    setup(builder) {
        builder.onLoad({ filter: rx_any, namespace: 'https' }, async (args) => {
            const specifier = ['https', args.path].join(":");
            const { moduleFilePath } = resolveImport(specifier);
            console.log(`(debun.plugin) \n\tloading ${specifier} \n\tlocal ${moduleFilePath}`);

            if (!pathExistsSync(moduleFilePath)) {
                await $`deno info ${specifier}`

                if (!pathExistsSync(moduleFilePath))
                    throw new Error(`Module not found: ${specifier} (${moduleFilePath})`);
            }

            return {
                contents: await Bun.file(moduleFilePath).bytes(),
                loader: "tsx"
            }
        })

        builder.onResolve({ filter: rx_relative_path }, (args) => {
            console.log(`(debun.plugin) \n\tresolving ${args.path} \n\tfrom ${args.importer}`);
            if (rx_http.test(args.importer)) {
                return {
                    path: String(new URL(args.path, args.importer))
                };
            }
        });
    }
}
// Based on:
// MIT License
// Copyright (c) 2020 Colin McDonnell
// https://github.com/colinhacks/zod/blob/master/deno-build.mjs
// This script expects to be run via `yarn build:deno`.
//
// Although this script generates code for use in Deno, this script itself is
// written for Node so that contributors do not need to install Deno to build.
//
// @ts-check

import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  cp,
  mkdir
} from "fs";
import { dirname } from "path";

import { generateDtsBundle } from 'dts-bundle-generator';

// Node's path.join() normalize explicitly-relative paths like "./index.ts" to
// paths like "index.ts" which don't work as relative ES imports, so we do this.
const join = (/** @type string[] */ ...parts) =>
  parts.join("/").replace(/\/\//g, "/");

const projectRoot = process.cwd();
const nodeSrcRoot = join(projectRoot, "src");
const distRoot = join(projectRoot, "dist");
const typesRoot = join(distRoot);
const typesBundleRoot = join(typesRoot, "types-bundle");
const denoLibRoot = join(distRoot, "deno");

const replacements = {
  "isows": "// native ws"
};

const walkAndBuild = (/** @type string */ dir) => {
  for (const entry of readdirSync(join(nodeSrcRoot, dir), {
    withFileTypes: true,
    encoding: "utf-8",
  })) {
    if (entry.isDirectory()) {
      walkAndBuild(join(dir, entry.name));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      const nodePath = join(nodeSrcRoot, dir, entry.name);
      const denoPath = join(denoLibRoot, dir, entry.name);

      if (nodePath.match(/.*\/.*\.spec\..*/)) {
        continue;
      }

      const nodeSource = readFileSync(nodePath, { encoding: "utf-8" });

      const denoSource = nodeSource.replace(
        /^(?:import|export|export type)[\s\S]*?from\s*['"]([^'"]*)['"];$/gm,
        (line, target) => {
          if (replacements[target]) {
            return replacements[target];
          }

          const targetNodePath = join(dirname(nodePath), target);
          const targetNodePathIfFile = targetNodePath + ".ts";
          const targetNodePathIfDir = join(targetNodePath, "index.ts");

          try {
            if (statSync(targetNodePathIfFile)?.isFile()) {
              return line.replace(target, target + ".ts");
            }
          } catch (error) {
            if (error?.code !== "ENOENT") {
              throw error;
            }
          }

          try {
            if (statSync(targetNodePathIfDir)?.isFile()) {
              return line.replace(target, join(target, "index.ts"));
            }
          } catch (error) {
            if (error?.code !== "ENOENT") {
              throw error;
            }
          }

          // console.warn(`Skipping non-resolvable import:\n  ${line}`);
          return line;
        }
      );

      mkdirSync(dirname(denoPath), { recursive: true });
      writeFileSync(denoPath, denoSource, { encoding: "utf-8" });
    }
  }
};

function replaceTypesImport() {
  const serverTypesFile = join(typesRoot, "server-types.d.ts");
  writeFileSync(serverTypesFile, "export * from './types-bundle';\n", "utf-8");
}

console.log("\nGenerate dts bundle...");

mkdir(typesBundleRoot, { recursive: true }, (err) => {
  if (err) throw err;
});

writeFileSync(join(typesBundleRoot, "index.d.ts"), generateDtsBundle([{
  filePath: join(nodeSrcRoot, "server-types.ts")
}]).join("\n"), "utf-8");

console.log("Replace types import...");

replaceTypesImport();

cp(typesBundleRoot, join(denoLibRoot, "types-bundle"), { recursive:true, force:true }, (err) => {
  if (err) {
    console.error(err);
  }
});

console.log("Deno build...");

walkAndBuild("");

console.log("Done.");

writeFileSync(
  join(denoLibRoot, "mod.ts"),
  "export * from './lib.ts';\n",
  {
    encoding: "utf-8",
  }
);

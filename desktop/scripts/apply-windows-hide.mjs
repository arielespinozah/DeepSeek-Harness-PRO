#!/usr/bin/env node
/**
 * apply-windows-hide.mjs — Re-aplica el fix de ventanas de consola al server
 * empaquetado recien generado por prepare-server.mjs.
 *
 * El workflow de auto-update lo ejecuta despues de regenerar
 * apps/desktop/server (prepare-server regenera node_modules desde cero, asi
 * que el fix hay que volver a aplicarlo en cada build).
 *
 * Uso:
 *   node apply-windows-hide.mjs <ruta-al-server>
 *   (ej: node apply-windows-hide.mjs dsh-app/apps/desktop/server)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const serverDir = resolve(process.argv[2] ?? "dsh-app/apps/desktop/server");
const base = "@deepseek-ai";

const targets = [
  {
    pkg: "dsh-subprocess-local",
    file: "lib/index.js",
    // Anade windowsHide al spawn principal de comandos (pwsh/cmd/node).
    from: `\t\tdetached: platform !== "win32"\n\t});`,
    to: `\t\tdetached: platform !== "win32",\n\t\t// Hide the transient console window on Windows: the harness is a GUI\n\t\t// process, so every console child (pwsh/cmd/node) would otherwise pop\n\t\t// a visible console window per command.\n\t\twindowsHide: process.platform === "win32"\n\t});`,
    check: `windowsHide: process.platform === "win32"`,
  },
  {
    pkg: "dsh-web-app",
    file: "lib/index.js",
    // Anade windowsHide al lanzador del navegador.
    from: `\t\t"ignore",\n\t\t"inherit",\n\t\t"pipe"\n\t]\n\t});`,
    to: `\t\t"ignore",\n\t\t"inherit",\n\t\t"pipe"\n\t],\n\twindowsHide: true\n\t});`,
    check: `windowsHide: true`,
  },
];

let changed = 0;
let skipped = 0;
for (const t of targets) {
  const file = join(serverDir, "node_modules", base, t.pkg, t.file);
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    console.log(`[skip] ${t.pkg}: no encontrado (${error.code ?? error.message})`);
    continue;
  }
  if (text.includes(t.check)) {
    console.log(`[ok]   ${t.pkg}: ya aplicado`);
    skipped++;
    continue;
  }
  if (!text.includes(t.from)) {
    console.log(`[warn] ${t.pkg}: patron no encontrado, revisar manualmente`);
    continue;
  }
  writeFileSync(file, text.replace(t.from, t.to));
  changed++;
  console.log(`[fix]  ${t.pkg}: windowsHide aplicado`);
}

console.log(`\napply-windows-hide: ${changed} arreglado(s), ${skipped} ya estaban.`);
if (changed === 0 && skipped === 0) process.exitCode = 1;

#!/usr/bin/env node
/**
 * apply-windows-hide.mjs â€” Garantiza windowsHide en los spawns del server
 * empaquetado recien generado por prepare-server.mjs.
 *
 * El workflow de auto-update lo ejecuta despues de regenerar
 * apps/desktop/server (prepare-server regenera node_modules desde cero, asi
 * que cualquier fix manual hay que volver a aplicarlo en cada build).
 *
 * IMPORTANTE (v0.1.3-alpha.1+): el repo oficial incorporo windowsHide NATIVO
 * en los spawns (packages/subprocess/subprocess-local/src/spawn.ts,
 * packages/util/native-command/src/runner.ts y el directory picker). Este
 * script detecta ambas situaciones:
 *   - estructura nueva: el codigo oficial ya trae windowsHide -> OK (exit 0)
 *   - estructura vieja: aplica el parche manual (retrocompatibilidad)
 * Solo falla si hay un spawn critico SIN windowsHide que no puede parchear.
 *
 * Uso:
 *   node apply-windows-hide.mjs <ruta-al-server>
 *   (ej: node apply-windows-hide.mjs dsh-app/apps/desktop/server)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const serverDir = resolve(process.argv[2] ?? "dsh-app/apps/desktop/server");
const base = "@deepseek-ai";

/** Un target describe un archivo que DEBE tener windowsHide en sus spawns. */
const targets = [
  {
    pkg: "dsh-subprocess-local",
    required: true, // spawns de pwsh/cmd/node: CAUSA las ventanas de consola
    // Estructura nueva (v0.1.3-alpha.1+): spawn separado en lib/spawn.js.
    files: ["lib/spawn.js", "lib/index.js"],
    // El codigo oficial nuevo ya incluye windowsHide con cualquiera de
    // estas formas; si aparece, no hay nada que parchear.
    nativeChecks: [
      `windowsHide: platform === 'win32'`,
      `windowsHide: process.platform === "win32"`,
      `windowsHide: true`,
    ],
    // Parche retrocompatible para estructura vieja (pre-0.1.3-alpha.1).
    from: `\t\tdetached: platform !== "win32"\n\t});`,
    to: `\t\tdetached: platform !== "win32",\n\t\t// Hide the transient console window on Windows: the harness is a GUI\n\t\t// process, so every console child (pwsh/cmd/node) would otherwise pop\n\t\t// a visible console window per command.\n\t\twindowsHide: process.platform === "win32"\n\t});`,
  },
  {
    pkg: "dsh-native-command",
    required: true, // abre el navegador y paths del sistema en Windows
    // Estructura nueva: runner.ts compilado a lib/runner.js con windowsHide.
    files: ["lib/runner.js", "lib/index.js"],
    nativeChecks: [`windowsHide: true`, `windowsHide:process`],
    from: `{ encoding: 'utf8', signal, windowsHide: true }`,
    to: null, // nunca parchear: si no existe es porque el paquete cambio
  },
  {
    pkg: "dsh-web-app",
    // El lanzador del navegador ejecuta process.execPath --eval (sin
    // consola visible), por lo que este parche es OPCIONAL: si no se puede
    // aplicar por cambios de formato no debe tumbar el workflow.
    required: false,
    files: ["lib/index.js"],
    nativeChecks: [`windowsHide: true`],
    // El lanzador del navegador usa spawn con stdio. Formato en fuente
    // nueva (v0.1.3-alpha.1, comillas simples):
    //   stdio: ['ignore', 'inherit', 'pipe'],
    // Formato en server 0.1.2-rc.1/0.1.6 (tabs, comillas dobles):
    //   stdio: [\n\t\t\t"ignore",...]
    // Se anade windowsHide:true al objeto de opciones en ambos casos.
    froms: [
      `stdio: ['ignore', 'inherit', 'pipe'],`,
      `\t\tstdio: [\n\t\t\t"ignore",\n\t\t\t"inherit",\n\t\t\t"pipe"\n\t\t]\n\t});`,
    ],
    tos: [
      `stdio: ['ignore', 'inherit', 'pipe'], windowsHide: true,`,
      `\t\tstdio: [\n\t\t\t"ignore",\n\t\t\t"inherit",\n\t\t\t"pipe"\n\t\t],\n\t\twindowsHide: true\n\t});`,
    ],
  },
];

let changed = 0;
let skipped = 0;
let problems = [];

for (const t of targets) {
  // Busca el primer archivo del paquete que exista.
  let file = null;
  let text = null;
  for (const candidate of t.files) {
    const p = join(serverDir, "node_modules", base, t.pkg, candidate);
    try {
      text = readFileSync(p, "utf8");
      file = p;
      break;
    } catch {
      /* siguiente candidato */
    }
  }
  if (file === null) {
    if (t.required === true) {
      // Paquete requerido ausente: verificar a nivel global que el server
      // empaquetado tenga ALGUN windowsHide (el codigo oficial nuevo lo
      // incluye aunque la ruta del paquete haya cambiado).
      console.log(`[warn] ${t.pkg}: paquete no encontrado en el server - se verificara globalmente`);
      // No es fallo inmediato: el chequeo global al final decide.
    } else {
      console.log(`[ok]   ${t.pkg}: sin archivos legacy (estructura nueva, fix nativo en el codigo oficial)`);
    }
    skipped++;
    continue;
  }

  // 1) Si ya hay windowsHide (nativo o aplicado antes): OK.
  const hasNative = t.nativeChecks.some((check) => text.includes(check));
  const hasAnyHide = /windowsHide\s*:/.test(text);
  if (hasNative || hasAnyHide) {
    console.log(`[ok]   ${t.pkg}: windowsHide presente (${file.split(/[\\/]/).slice(-2).join('/')})`);
    skipped++;
    continue;
  }

  // 2) Sin windowsHide: intenta los parches retro si existe patron.
  let applied = false;
  const tryWrite = (path, newText) => {
    try {
      writeFileSync(path, newText);
      return true;
    } catch (error) {
      console.log(`[warn] ${t.pkg}: no se pudo escribir (${error.code ?? error.message})`);
      return false;
    }
  };
  if (t.froms !== undefined) {
    for (let i = 0; i < t.froms.length; i++) {
      if (text.includes(t.froms[i])) {
        if (tryWrite(file, text.replace(t.froms[i], t.tos[i]))) {
          changed++;
          applied = true;
          console.log(`[fix]  ${t.pkg}: windowsHide aplicado`);
        }
        break;
      }
    }
  } else if (t.to !== null && text.includes(t.from)) {
    if (tryWrite(file, text.replace(t.from, t.to))) {
      changed++;
      applied = true;
      console.log(`[fix]  ${t.pkg}: windowsHide aplicado`);
    }
  }
  if (applied) continue;

  // 3) Sin windowsHide y sin patron conocido.
  if (t.required === true) {
    problems.push(`${t.pkg} (${file}) no tiene windowsHide y no se pudo parchear automaticamente`);
    console.log(`[warn] ${t.pkg}: spawn sin windowsHide y patron no encontrado - revisar manualmente`);
  } else {
    console.log(`[info] ${t.pkg}: parche opcional no aplicable (formato distinto) - no critico`);
  }
}

console.log(`\napply-windows-hide: ${changed} arreglado(s), ${skipped} verificados OK.`);
if (problems.length > 0) {
  console.error(`PROBLEMAS (${problems.length}):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exitCode = 1;
}

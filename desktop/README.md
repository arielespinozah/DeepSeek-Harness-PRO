# DeepSeek Harness Desktop

**Shell de escritorio para [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)** (Windows x64).

Una app Electron que arranca el servidor `dsh` empaquetado en un puerto local
de bucle invertido, abre la interfaz web oficial y se **actualiza sola con un
clic** desde GitHub Releases. Todo el código del servidor proviene del
[repositorio oficial](https://github.com/deepseek-ai/deepseek-harness) — este
proyecto solo aporta el contenedor de escritorio (shell) y su canal de
distribución.

---

## ✨ Características

- 🚀 **Servidor oficial**: arranca el código `dsh` 100 % del repositorio
  oficial de DeepSeek (sin modificaciones al harness).
- 🔄 **Auto-actualización con 1 clic**: al abrir la app consulta
  `releases/latest`; si hay versión nueva la descarga en segundo plano y solo
  pide *Reiniciar ahora*.
- 🔒 **Seguro por diseño**: perfiles, claves y ajustes viven en
  `%APPDATA%\DeepSeek Harness Desktop\dsh` (no se tocan al actualizar).
- 🖥️ **Sin ventanas de consola**: todos los procesos auxiliares (pwsh, cmd)
  corren ocultos; la app no interrumpe el trabajo en primer plano.
- 🧹 **Sin datos personales**: las rutas de compilación se limpian del
  paquete final.

---

## 📥 Instalación en Windows (usuarios finales)

### Opción A — Instalador automático (recomendada)

1. Descarga el instalador más reciente desde
   **[Releases](https://github.com/arielespinozah/DeepSeek-Harness-PRO/releases/latest)**
   (archivo `DeepSeek.Harness.Desktop.Setup.<version>.exe`).
2. Ejecuta el `.exe` y haz clic en **Instalar** (puedes cambiar la carpeta de
   instalación si quieres).
3. Al terminar, la app se abre sola con la interfaz de DeepSeek Harness.
4. *(Primera vez)* Windows SmartScreen mostrará una advertencia porque el
   binario no está firmado — haz clic en **Más información → Ejecutar de
   todas formas**. Es normal en software comunitario sin firma de código.

### Opción B — Instalación silenciosa (IT / despliegue)

```powershell
# Instala sin ventanas, en el directorio por defecto
Start-Process -FilePath "DeepSeek.Harness.Desktop.Setup.<version>.exe" -ArgumentList "/S"
```

---

## 🔄 Cómo funcionan las actualizaciones

| Paso | Quién lo hace | Cuándo |
|---|---|---|
| 1. Publicar versión nueva | Mantenedor (build + `latest.yml` al repo) | Al salir una versión nueva |
| 2. Detectar la versión | La app (electron-updater) | En cada arranque y con Ctrl+U |
| 3. Descargar | La app, en segundo plano | Automático al detectar |
| 4. Instalar | La app (1 clic: *Reiniciar ahora*) | Cuando el usuario confirma |

El canal de actualización está definido en
[`app-update.yml`](https://github.com/arielespinozah/DeepSeek-Harness-PRO)
(`owner: arielespinozah`, `repo: DeepSeek-Harness-PRO`). No depende del
repositorio oficial de DeepSeek: cuando el harness publica código nuevo, el
mantenedor regenera el instalador y lo publica aquí; todas las instalaciones
existentes se actualizan solas.

---

## 🛠️ Compilar desde el código (para desarrolladores)

### Requisitos

- Windows x64
- [Node.js](https://nodejs.org) ≥ 20 y `npm`
- [pnpm](https://pnpm.io) (para construir el servidor del monorepo)
- Acceso al repositorio oficial de DeepSeek Harness (para regenerar `dsh-app`)

### Estructura

```
DeepSeek Harness Oficial/
├── desktop/            ← este proyecto (shell Electron)
│   ├── src/main.js     ← proceso principal (arranca el server + updater)
│   ├── build/          ← iconos
│   └── package.json    ← configuración electron-builder + feed
└── dsh-app/            ← monorepo oficial (se regenera desde deepseek-ai)
```

### Pasos

```powershell
# 1. (Opcional) Regenerar el servidor empaquetado desde el repo oficial
#    cd dsh-app && pnpm install && npm run build
#    node apps/desktop/scripts/prepare-server.mjs

# 2. Instalar dependencias del shell
cd desktop
npm install

# 3. Empaquetar el instalador (sin publicar)
npm run pack

# 4. Publicar una actualización para la comunidad
#    (requiere GH_TOKEN con permiso "repo" y owner/repo propios en package.json)
npm run publish
```

El instalador queda en `desktop/dist/` como
`DeepSeek.Harness.Desktop.Setup.<version>.exe` y se sube a la GitHub Release
junto con `latest.yml`, que es lo que las instalaciones existentes consultan
para auto-actualizarse.

---

## 🧹 Privacidad y notas

- La app no envía datos del usuario a ningún servidor propio; las claves de
  API se guardan localmente en `%APPDATA%\DeepSeek Harness Desktop\dsh`.
- El binario no está firmado con un certificado de código; SmartScreen avisará
  en la primera ejecución (aceptable para proyectos comunitarios).
- Los datos (perfiles, sesiones, workspaces) se conservan intactos al
  desinstalar/actualizar porque viven fuera de la carpeta del programa.

---

## 📄 Licencia

El shell (`desktop/`) se distribuye bajo **MIT**. El servidor embebido
pertenece a [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
(MIT), sin modificaciones.

> **Nota de seguridad (del proyecto oficial):** DeepSeek Harness aún no ha
> sido auditado en seguridad; la sandbox, aprobaciones y permisos no
> garantizan aislamiento total.

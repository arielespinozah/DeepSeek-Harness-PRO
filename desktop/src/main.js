/**
 * DeepSeek Harness Desktop (Electron main process).
 *
 * Boots the packaged dsh web server (a production-deployed copy of the
 * @deepseek-ai/dsh CLI tree, resources/server) on an OS-assigned loopback
 * port, then opens a BrowserWindow at the printed URL. Before boot it writes a
 * harness user layer that pins the browse directory picker: the native Win32
 * dialog crashes when the harness runs under Electron-as-node (koffi), while
 * the browse backend is pure filesystem. Update checks ride electron-updater
 * against the GitHub Releases of the configured repository, surfaced through
 * native dialogs plus an app menu item.
 */
const { app, BrowserWindow, Menu, dialog, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const { spawn } = require('node:child_process')
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const path = require('node:path')

const SERVER_BOOT_TIMEOUT_MS = 30000
const LOOPBACK = '127.0.0.1'
const PRODUCT = 'DeepSeek Harness Desktop'

/**
 * The harness home: the app's user-data directory, so profiles, credentials
 * and settings live under the OS-managed app data and uninstall stays clean.
 */
function harnessHome() {
  return path.join(app.getPath('userData'), 'dsh')
}

/**
 * Pin the browse directory picker through the home user layer. The composed
 * `directory-picker-auto` row resolves to `native` on win32, whose koffi
 * dialog crashes under Electron-as-node; disabling it and mounting the browse
 * host backend + client surface keeps workspace creation working everywhere.
 * Idempotent — rewritten verbatim on every launch.
 */
function writeHomePatch() {
  const home = harnessHome()
  mkdirSync(home, { recursive: true })
  const patch = [
    '# DeepSeek Harness Desktop user layer (machine-local overrides).',
    '# Pins the browse directory picker: the native Win32 dialog crashes when',
    '# the harness runs under Electron-as-node (koffi); browse is pure fs.',
    '- id: directory-picker',
    '  disabled: true',
    '- insert:',
    '    - id: directory-picker-browse',
    "      name: '@deepseek-ai/dsh-host-directory-picker-browse'",
    '    - id: ui-directory-picker-browse',
    "      name: '@deepseek-ai/dsh-client-ui-directory-picker-browse'",
    '',
  ].join('\n')
  writeFileSync(path.join(home, 'cordis.patch.yml'), patch)
}

/** Absolute path of the dsh CLI bin this app boots. */
function serverBin() {
  const packagedBin = path.join(process.resourcesPath, 'server', 'lib', 'bin.js')
  if (app.isPackaged) return packagedBin
  const sourceBin = path.join(__dirname, '..', '..', 'apps', 'cli', 'lib', 'bin.js')
  if (existsSync(sourceBin)) return sourceBin
  return packagedBin
}

/**
 * Start the dsh web server and resolve the URL it reports on stdout
 * ("dsh web: http://127.0.0.1:<port>").
 * @returns the child process and a promise of the web URL.
 */
function startServer() {
  writeHomePatch()
  const server = spawn(process.execPath, [serverBin(), 'web', '--port', '0', '--no-open'], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      DSH_HOME: harnessHome(),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stderr = ''
  server.stderr.on('data', chunk => { stderr += String(chunk) })
  const url = new Promise((resolve, reject) => {
    let settled = false
    const fail = (detail) => {
      if (settled) return
      settled = true
      reject(new Error(`dsh server failed to start: ${detail}\n${stderr}`))
    }
    const timeout = setTimeout(() => { fail(`no URL within ${SERVER_BOOT_TIMEOUT_MS}ms`) }, SERVER_BOOT_TIMEOUT_MS)
    let stdout = ''
    server.stdout.on('data', (chunk) => {
      stdout += String(chunk)
      const match = stdout.match(/dsh web: (http:\/\/[^\s]+)/)
      if (match !== null && !settled) {
        settled = true
        clearTimeout(timeout)
        resolve(match[1])
      }
    })
    server.on('exit', (code) => { if (!settled) fail(`process exited with code ${code}`) })
  })
  return { server, url }
}

/**
 * Whether the packaged update feed is actually configured. electron-updater
 * reads resources/app-update.yml; a build that never replaced the owner
 * placeholder (YOUR_GITHUB_OWNER, CHANGE_ME, ...) has no reachable feed, so
 * update checks are skipped instead of 404ing on GitHub on every launch.
 */
function updateFeedConfigured() {
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, 'app-update.yml')]
    : [path.join(__dirname, 'app-update.yml'), path.join(process.resourcesPath, 'app-update.yml')]
  for (const file of candidates) {
    if (!existsSync(file)) continue
    try {
      const text = readFileSync(file, 'utf8')
      const owner = /(?:^|\n)\s*owner\s*:\s*([^\s#]+)/.exec(text)?.[1] ?? ''
      const repo = /(?:^|\n)\s*repo\s*:\s*([^\s#]+)/.exec(text)?.[1] ?? ''
      if (owner !== '' && repo !== '' && !/YOUR_GITHUB_OWNER|CHANGE_ME|<owner>|your[-_ ]?owner/i.test(owner)) return true
    } catch { /* unreadable feed: treat as unconfigured */ }
  }
  return false
}

/** Present the auto-updater lifecycle through native dialogs. */
function wireUpdater() {
  let manualCheck = false
  const feedConfigured = updateFeedConfigured()
  // One-click updates: the app downloads the update as soon as it is found
  // and only asks once, to restart and install.
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('update-available', (info) => {
    manualCheck = false
    dialog.showMessageBox({
      type: 'info',
      title: 'Actualizacion disponible',
      message: `${PRODUCT} ${info.version} esta disponible.`,
      detail: `Tienes la version ${app.getVersion()}. Se esta descargando en segundo plano; te avisaremos cuando este lista para instalar.`,
      buttons: ['OK'],
    }).catch(() => {})
  })
  autoUpdater.on('update-not-available', () => {
    // A launch check reports nothing; only a manual check answers with a box.
    if (!manualCheck) return
    manualCheck = false
    dialog.showMessageBox({
      type: 'info',
      title: 'Sin actualizaciones',
      message: `Ya tienes la ultima version (${app.getVersion()}).`,
      buttons: ['OK'],
    }).catch(() => {})
  })
  autoUpdater.on('update-downloaded', (info) => {
    manualCheck = false
    dialog.showMessageBox({
      type: 'info',
      title: 'Actualizacion lista',
      message: `La version ${info.version} se descargo e instalara al reiniciar.`,
      detail: 'Reinicia ahora para completar la actualizacion.',
      buttons: ['Reiniciar ahora', 'Mas tarde'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall()
    }).catch(() => {})
  })
  autoUpdater.on('error', (error) => {
    // Only a manual check answers with an error box. Background launch checks
    // must never interrupt the user with a dialog (a misconfigured or missing
    // feed would otherwise 404 on GitHub on every start).
    if (!manualCheck) {
      console.error('update check failed:', error)
      return
    }
    manualCheck = false
    const message = String(error)
    if (/404|latest\.yml|latest release|no releases|not found/i.test(message)) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Actualizaciones',
        message: 'No se encontraron instaladores en el canal de actualizaciones.',
        detail: 'El repositorio configurado aun no publica instaladores de escritorio. Verifica que exista un release publicado con el instalador (latest.yml).',
        buttons: ['OK'],
      }).catch(() => {})
      return
    }
    dialog.showErrorBox('Error de actualizacion', message)
  })
  return {
    markManual: () => { manualCheck = true },
    configured: feedConfigured,
  }
}

/** App already running: focus the existing window and quit. */
const hasLock = app.requestSingleInstanceLock()
if (!hasLock) {
  app.quit()
} else {
  let window = null
  let server = null

  const createWindow = (url) => {
    window = new BrowserWindow({
      width: 1360,
      height: 860,
      minWidth: 940,
      minHeight: 600,
      title: `${PRODUCT} v${app.getVersion()}`,
      autoHideMenuBar: true,
      icon: app.isPackaged ? path.join(process.resourcesPath, 'icon.png') : undefined,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    })
    window.setMenuBarVisibility(false)
    window.webContents.setWindowOpenHandler(({ url: target }) => {
      if (target.startsWith('http://127.0.0.1') || target.startsWith('http://localhost')) {
        return { action: 'allow' }
      }
      shell.openExternal(target)
      return { action: 'deny' }
    })
    window.loadURL(url).catch(() => {})
    window.on('closed', () => { window = null })
  }

  app.on('second-instance', () => {
    if (window !== null) {
      if (window.isMinimized()) window.restore()
      window.focus()
    }
  })

  app.whenReady().then(async () => {
    const updater = app.isPackaged ? wireUpdater() : null
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { role: 'appMenu', submenu: [
        { role: 'about', label: `Acerca de ${PRODUCT} v${app.getVersion()}` },
        { type: 'separator' },
        {
          label: 'Buscar actualizaciones',
          accelerator: 'CmdOrCtrl+U',
          click: () => {
            if (updater === null) {
              dialog.showMessageBox({
                type: 'info',
                title: 'Buscar actualizaciones',
                message: 'Las actualizaciones se verifican en la version instalada.',
                buttons: ['OK'],
              }).catch(() => {})
              return
            }
            if (!updater.configured) {
              dialog.showMessageBox({
                type: 'info',
                title: 'Actualizaciones no configuradas',
                message: 'El canal de actualizaciones no esta configurado.',
                detail: 'Edita resources/app-update.yml con tu usuario y repositorio de GitHub (con releases publicados) para habilitar las actualizaciones.',
                buttons: ['OK'],
              }).catch(() => {})
              return
            }
            updater.markManual()
            autoUpdater.checkForUpdates().catch(() => {})
          },
        },
        { type: 'separator' },
        { role: 'quit', label: 'Salir' },
      ] },
      { role: 'editMenu' },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
    ]))
    try {
      const booted = startServer()
      server = booted.server
      const url = await booted.url
      createWindow(url)
    } catch (error) {
      dialog.showErrorBox(PRODUCT, `No se pudo iniciar el servidor: ${String(error)}`)
      app.quit()
    }
    if (app.isPackaged && updater !== null && updater.configured) {
      // Silent background check on launch; notifications appear only when an
      // update exists (update-not-available only answers a manual check).
      // Skipped entirely when app-update.yml still carries the build
      // placeholder, so an unconfigured feed never 404s on GitHub.
      autoUpdater.checkForUpdates().catch(() => {})
    }
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  app.on('will-quit', () => {
    if (server !== null && !server.killed) server.kill()
  })
}

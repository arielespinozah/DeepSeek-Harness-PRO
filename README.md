# DeepSeek Harness Desktop

**Shell de escritorio para [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)** — Windows x64.

App Electron que arranca el servidor `dsh` oficial en un puerto local, abre la
interfaz web en una **ventana nativa** y se **auto-actualiza con 1 clic**.

> **Transparencia:** el motor (agente, herramientas, modelos) es el código
> oficial de DeepSeek **sin modificaciones**. Este proyecto aporta la capa de
> escritorio: instalador `.exe`, ventana nativa, auto-update y procesos
> ocultos. No añade capacidades al agente.

## 🤖 Actualización automática desde el repo oficial

Un [workflow de GitHub Actions](.github/workflows/auto-update.yml) revisa el
repositorio oficial de DeepSeek **cada 6 horas** (y puede ejecutarse a mano
con el botón *Run workflow*). Cuando DeepSeek publica una versión nueva:

1. Descarga el código oficial del tag
2. Compila el harness (perfil `official`)
3. Empaqueta el servidor + re-aplica el fix de ventanas de consola
4. Genera el instalador y publica la release aquí

Las apps instaladas detectan la versión nueva y se actualizan solas con 1 clic.

## 📥 Descargar e instalar (Windows)

1. Ve a **[Releases](https://github.com/arielespinozah/DeepSeek-Harness-PRO/releases/latest)**
2. Descarga `DeepSeek.Harness.Desktop.Setup.<version>.exe`
3. Ejecútalo → **Instalar** → listo

> SmartScreen puede avisar (binario sin firmar): **Más información → Ejecutar de todas formas**.

## 🆚 vs. el oficial

| | `dsh` oficial | Este proyecto |
|---|---|---|
| Instalación | Manual (Node + build) | **`.exe` de 1 clic** |
| Interfaz | Pestaña del navegador | **Ventana nativa** |
| Actualización | Rebuild manual | **Auto-update 1 clic** |
| Consolas | Visibles | **Ocultas** |
| Capacidades | Referencia | **Idénticas** |

## 🛠️ Compilar localmente

```powershell
cd desktop
npm install
npm run pack        # genera dist\Setup.exe (sin publicar)
npm run publish     # construye + sube a GitHub Releases (requiere GH_TOKEN)
```

## 📄 Licencia

Shell: **MIT**. Servidor embebido: [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) (MIT), sin modificaciones.
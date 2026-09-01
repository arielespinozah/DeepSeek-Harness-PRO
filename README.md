# DeepSeek Harness Desktop

**Shell de escritorio para [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)** — Windows x64.

App Electron que arranca el servidor `dsh` oficial en un puerto local, abre la
interfaz web en una **ventana nativa** y se **auto-actualiza con 1 clic**
desde GitHub Releases.

> **Transparencia:** el motor (agente, herramientas, modelos) es el código
> oficial de DeepSeek **sin modificaciones**. Este proyecto solo aporta la
> capa de escritorio: instalador `.exe`, ventana nativa, auto-update y
> procesos ocultos. No añade capacidades al agente.

## 📥 Descargar e instalar (Windows)

1. Ve a **[Releases](https://github.com/arielespinozah/DeepSeek-Harness-PRO/releases/latest)**
2. Descarga `DeepSeek.Harness.Desktop.Setup.<version>.exe`
3. Ejecútalo → **Instalar** → listo

> SmartScreen puede avisar (binario sin firmar): **Más información → Ejecutar de todas formas**.

## 🔄 Actualizaciones

La app consulta este repo al abrir; si hay versión nueva la descarga sola y
pide *Reiniciar ahora* (1 clic). Tu historial de sesiones se conserva intacto.

## 🆚 vs. el oficial

| | `dsh` oficial | Este proyecto |
|---|---|---|
| Instalación | Manual (Node + build) | **`.exe` de 1 clic** |
| Interfaz | Pestaña del navegador | **Ventana nativa** |
| Actualización | Rebuild manual | **Auto-update 1 clic** |
| Consolas | Visibles | **Ocultas** |
| Capacidades | Referencia | **Idénticas** |

## 🛠️ Compilar

```powershell
cd desktop
npm install
npm run pack        # genera dist\Setup.exe (sin publicar)
npm run publish     # construye + sube a GitHub Releases (requiere GH_TOKEN)
```

Ver [documentación completa](desktop/README.md) para detalles y estructura.

## 📄 Licencia

Shell: **MIT**. Servidor embebido: [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) (MIT), sin modificaciones.
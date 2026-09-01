# DeepSeek Harness Desktop

**Shell de escritorio para [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)** — Windows x64.

App Electron que arranca el servidor `dsh` oficial en un puerto local, abre la
interfaz web y se **auto-actualiza con 1 clic** desde GitHub Releases.

## 📥 Descargar e instalar (Windows)

1. Ve a **[Releases](https://github.com/arielespinozah/DeepSeek-Harness-PRO/releases/latest)**
2. Descarga `DeepSeek.Harness.Desktop.Setup.<version>.exe`
3. Ejecútalo → **Instalar** → listo

> SmartScreen puede avisar (binario sin firmar): **Más información → Ejecutar de todas formas**.

## 🔄 Actualizaciones

La app consulta este repo al abrir; si hay versión nueva la descarga sola y
pide *Reiniciar ahora* (1 clic). Tu historial de sesiones se conserva intacto.

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

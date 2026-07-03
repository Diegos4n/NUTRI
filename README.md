# NutriApp 🍽️

App móvil (web/PWA) para registrar tus comidas habituales y ver tu balance nutricional del día y la semana.

## Qué hace (MVP validado)
- **Hoy**: kcal y macros del día vs. tus objetivos, con barras de progreso.
- **Mis platos**: platos preguardados con sus macros (por ración o por 100 g). Añadir al día en 2 toques.
- **Escanear**: lee el código de barras de un envase y trae sus valores de **Open Food Facts** (o busca por código a mano).
- **Stats**: media semanal, gráfico de 7 días, comparativa **vs. semana anterior** y análisis de déficits (te falta proteína, te pasas de grasas, etc.).
- Todo se guarda **en el propio móvil** (localStorage). Botón de exportar copia de seguridad.

## Cómo llevarla al móvil (HTTPS, para el viaje)

La cámara (escáner) necesita HTTPS. La forma más rápida sin instalar nada:

### Opción A — Netlify Drop (2 min, recomendada)
1. Entra desde el PC a **https://app.netlify.com/drop**
2. Arrastra la carpeta `NutriApp` entera a la página.
3. Te da una URL `https://...netlify.app` → ábrela en el móvil.
4. En el móvil: menú del navegador → **«Añadir a pantalla de inicio»**. Ya tienes el icono como una app.

### Opción B — GitHub Pages
Repo ya inicializado. Con `gh` instalado y sesión iniciada:
```
gh repo create nutriapp --public --source=. --push
gh api repos/:owner/nutriapp/pages -f source[branch]=main -f source[path]=/
```
Luego la URL será `https://<usuario>.github.io/nutriapp/`.

## Probar en local (misma WiFi)
`python -m http.server 5599 --directory .` y abre `http://<IP-del-PC>:5599` en el móvil.
Nota: por LAN la cámara puede estar bloqueada (requiere HTTPS); el resto funciona.

## Roadmap
- **Fase 3**: foto de un plato → identificar con IA (API de visión) vía un backend FastAPI.
- Versión nativa en **Flutter** reutilizando este modelo de datos.

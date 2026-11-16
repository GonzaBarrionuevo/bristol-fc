# Bristol F.C. · Cuotas y carnet digital (MVP)

Aplicación web responsive (PWA, pensada para el celular) para gestionar cuotas y carnets de un club deportivo de barrio. Prototipo desarrollado como parte del Trabajo Final del ITI: *Diagnóstico de necesidades tecnológicas y transformación digital en un club deportivo barrial de la Ciudad de Buenos Aires: estudio de caso del Bristol F.C.*

**Demo pública:** https://gonzabarrionuevo.github.io/bristol-fc/ *(se publica con GitHub Pages)*

## Credenciales de prueba
| Perfil | Usuario | Contraseña |
|---|---|---|
| Socio | `soc01` | `soc01` |
| Administración | `admin01` | `admin01` |

## Qué hace
**Socio (soc01):** aviso de términos y datos personales (primera vez), ficha (nombre, apellido, categoría, actividad), estado de cuotas (Pagado / Adeudado), próximo vencimiento y monto, botón **Pagar** (ventana informativa con Alias/CVU, QR de ejemplo y efectivo en secretaría; no procesa pagos), **carnet digital** con grilla de 12 meses, horarios, avisos, asistencia y botón de **WhatsApp**.

**Administración (admin01):** listado de socios con filtros por actividad y estado y buscador; **+ Registrar Pago** (socio, mes, monto, medio: efectivo / transferencia / Mercado Pago); alta de socios; importación simulada desde CSV; asistencia; avisos; **cierre del mes** con subtotales por medio de pago y descarga en CSV (abre en Excel).

## Datos de ejemplo
Se generan al abrir la app, con el **año y mes actuales** (no hay fechas fijas): Mateo González (Baby Fútbol, Infantil, al día) y 6 socios ficticios, algunos con cuotas atrasadas.

## Cómo funcionan los datos
- **Con Supabase (modo nube):** los datos se guardan en una base PostgreSQL en la nube. Lo que registra el admin aparece en el celular del socio en pocos segundos (la app consulta cada 3 s), sin recargar. Un cartel arriba indica "● En línea · datos compartidos".
- **Sin conexión o si Supabase no responde (modo local):** la app sigue funcionando y guarda en el navegador (IndexedDB). Cartel: "● Modo local · este dispositivo".
- **Configuración:** crear la tabla ejecutando `supabase.sql` en el SQL Editor de Supabase; la URL y la clave pública (*publishable*) van en `src/config.js`.
- **Limitaciones (es una demo):** la tabla es pública para la clave anónima y el estado se guarda completo en una fila; los roles y el login se validan en el navegador y las claves van hasheadas (SHA-256). Usar solo datos ficticios. En producción: Supabase Auth, políticas por rol (RLS) y tablas separadas (socios, cuotas, pagos), con cumplimiento de la Ley 25.326 de Protección de Datos Personales.
- Los textos se renderizan con React (escapa el HTML por defecto).
- Alias, CVU, QR, horarios y número de WhatsApp son **datos de ejemplo** (editar `src/config.js`).

## Tecnologías
React 19 · Vite · Supabase (PostgreSQL, API REST) · IndexedDB (respaldo local) · PWA (manifest + service worker *network first*, caché `bristol-v2`) · GitHub Pages (GitHub Actions).

## Ejecutar en local
```bash
npm install
npm run dev      # desarrollo
npm run build    # genera /dist
```

## Publicar
1. Subir el proyecto a GitHub (rama `main`).
2. En **Settings → Pages**, elegir **Source: GitHub Actions**.
3. El workflow `.github/workflows/deploy.yml` compila y publica en cada `push`.

## Estructura
```
src/config.js   datos editables del club (alias, WhatsApp, horarios, precios)
src/seed.js     datos de ejemplo y usuarios
src/logic.js    reglas de negocio (estado de cuotas, vencimientos, cierre CSV)
src/db.js       persistencia (Supabase + respaldo local)
supabase.sql    tabla y políticas de la demo
src/App.jsx     pantallas de socio y administración
public/         manifest, service worker e íconos (192/512)
```

## Autor
Gonzalo Barrionuevo · ITI · Taller de Trabajo Final · 2026

# Gym Tutor 🏋️

Aplicación web responsiva (PWA instalable en el teléfono) que guía a principiantes en el gimnasio:

- **Coach IA (Claude)**: el usuario cuenta cuánto tiempo tiene, cómo se siente o qué quiere trabajar, y recibe una rutina de **4–5 ejercicios** con imágenes de ejecución, claves de técnica en español y enlace a video.
- **Modo entrenamiento**: registro de series, peso y repeticiones, temporizador de descanso y "la vez pasada levantaste X kg" (sobrecarga progresiva).
- **Asistencia y hábitos**: check-in diario, semana actual vs. meta, racha de semanas cumplidas, calendario mensual e historial.
- **Insights IA**: análisis de las últimas 4 semanas (constancia, días que falla, esfuerzo, progresión de cargas, peso corporal) según el objetivo.
- **Biblioteca** de ~870 ejercicios ([free-exercise-db](https://github.com/yuhonas/free-exercise-db), dominio público) con filtros por músculo y equipamiento.
- Login con **Google** (Supabase Auth).

## Arquitectura

| Capa | Tecnología | Hosting |
|---|---|---|
| Frontend | React 19 + Vite + Tailwind v4 + PWA | Vercel (gratis) |
| Base de datos + Auth | Postgres + RLS + Google OAuth | Supabase (gratis) |
| Backend / IA | Supabase Edge Functions (`coach`, `insights`) → Anthropic API | Supabase |
| DNS / dominio | CNAME a Vercel | Cloudflare |

```
Navegador ──► Vercel (SPA estática)
   │
   ├──► Supabase Postgres (RLS: cada usuario solo ve sus datos)
   └──► Edge Function coach/insights ──► Claude (API key solo en el servidor)
```

La IA **solo puede elegir ejercicios del catálogo** (se valida en el servidor), así cada ejercicio siempre tiene imagen.

## Estructura

```
src/                     Frontend
  pages/                 Login, Onboarding, Home, Coach, Routine, Workout, Progress, Exercises, Profile
  components/            UI, RoutineView, ExerciseMedia, ProfileForm, Layout
  lib/                   supabase client, auth, tipos, fechas, etiquetas
supabase/
  migrations/            Esquema + políticas RLS
  seed_exercises.sql     Carga del catálogo de ejercicios
  functions/             Edge Functions (Deno): coach, insights, _shared
```

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # URL y publishable key de Supabase
npm run dev
```

## Puesta en producción (checklist)

Proyecto Supabase: `gym-tutor` (ref `xfbkwpdzocaqgaogdzzh`, región São Paulo). Esquema, catálogo y Edge Functions **ya están desplegados**.

1. **API key de Anthropic** → Supabase › Edge Functions › Secrets: `ANTHROPIC_API_KEY=sk-ant-...`
   (opcional `ANTHROPIC_MODEL`, por defecto `claude-haiku-4-5`).
2. **Google OAuth**
   - Google Cloud Console › APIs y servicios › Credenciales › *Crear ID de cliente OAuth* (Aplicación web).
   - Orígenes autorizados: `https://TU-DOMINIO` y `http://localhost:5173`.
   - URI de redirección autorizada: `https://xfbkwpdzocaqgaogdzzh.supabase.co/auth/v1/callback`.
   - Copia Client ID y Secret en Supabase › Authentication › Sign In / Providers › Google.
3. **URLs de Auth** → Supabase › Authentication › URL Configuration:
   - Site URL: `https://TU-DOMINIO`
   - Redirect URLs: `https://TU-DOMINIO/**`, `https://*.vercel.app/**`, `http://localhost:5173/**`
4. **Vercel** → importar este repo; variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. **Cloudflare DNS** → registro `CNAME` `app` (o el subdominio que elijas) → `cname.vercel-dns.com`, **proxy desactivado (nube gris)**; luego agrega el dominio en Vercel › Settings › Domains.

## Costos y límites

- Rutina ≈ 1 llamada a Claude Haiku (catálogo en caché de prompt) → fracciones de centavo.
- Límite de 40 mensajes al coach por usuario/día y 1 análisis de insights cada 6 h (configurable en las funciones).

## Aviso

Gym Tutor ofrece orientación general y no reemplaza a un profesional de la salud o entrenador certificado.

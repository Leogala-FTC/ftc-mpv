# FTC MVP

MVP authentication shell built with **Next.js 14 App Router**, **TypeScript strict**, and **Tailwind CSS**.

## Environment variables
Create `.env.local` in project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> Do not use service role keys in this app.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Build

```bash
npm run build
```

## Routes included
- `/` unified auth page (Accedi / Registrati)
- `/forgot` password reset request
- `/reset-confirm` set new password
- `/onboarding` placeholder
- `/user` placeholder
- `/merchant` placeholder
- `/admin` placeholder

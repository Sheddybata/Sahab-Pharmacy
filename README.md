# Sahab Pharmacy – Inventory Management System

This project is a Vite + React + TypeScript application that powers the Sahab Pharmacy inventory, POS, and analytics dashboard. The codebase uses Supabase for persistence and authentication-related services, Tailwind for styling, and shadcn/ui for component primitives.

## Getting Started

```bash
pnpm install    # or npm install
pnpm run dev    # or npm run dev
```

Create an `env.local` (or `.env`) file based on `env.example` before running the app:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Building Locally

```bash
pnpm run build
pnpm run preview
```

## Deploying to Vercel

1. Set the project root to this repository.
2. Use `npm run build` (or `pnpm run build`) as the build command.
3. Set the output directory to `dist`.
4. Add the required runtime environment variables under **Settings → Environment Variables** using the keys in `env.example`.
5. The included `vercel.json` handles single-page-app rewrites so client-side routes resolve correctly.

After pushing to GitHub, trigger a Vercel deployment. If the deployed site is blank, open the browser console to confirm the Supabase env vars are available and check deployment logs for missing configuration.

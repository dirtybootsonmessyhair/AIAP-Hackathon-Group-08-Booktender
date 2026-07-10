# Booktender engineering guide

Browser-only responsive MVP: Next.js, TypeScript, Tailwind, Supabase and Vercel.

## Commands

- `pnpm dev` — run locally
- `pnpm typecheck` — TypeScript check
- `pnpm build` — production build

## Architecture

`app/` contains the web experience. `supabase/migrations/` is the recreatable database schema. The public demo must remain functional with the deterministic local fallback when AI or Supabase are unavailable.

## Privacy and safety

- Never commit `.env.local`, API keys, service-role keys, or real user data.
- Gemini calls must remain server-side.
- Only public-domain/original/short legally safe reading content is permitted.
- User records require Supabase RLS; catalogue and community management require an administrator role.
- The public admin demo is read-only.

## Definition of done

The browser app must demonstrate Discover → Save → Read → Highlight → Track → Discuss in under three minutes on mobile and desktop, returning exactly three verified catalogue books even when AI fails.

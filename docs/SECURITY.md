# Security notes

PokeVerse-3D is designed to run **locally** for development and play. The notes below
summarize an audit of the server and admin code and what to do before exposing it beyond
your own machine.

## What is handled well

- **Password storage** uses `scrypt` with a random per-user salt (`salt:hash`).
- **Admin writes are constrained**: every editable collection is whitelisted in
  `admin/esquemas.mjs`, inputs are validated, map names are regex-checked, uploaded GLBs
  are verified by their glTF header, writes are atomic, and the previous version is backed
  up before each save.
- **Rate limiting** on account creation, login, and password recovery (per IP).
- **Server-side validation** of catches and starter Pokémon (IVs, nature, shiny, species)
  to block client-forged data.

## Things to review before exposing the server publicly

1. **Never commit live data.** `server/data/` (accounts, saves, admin logs, backups)
   contains password hashes and email addresses. It is gitignored; keep it that way.
2. **No seeded accounts.** Do not ship a pre-made GM account (e.g. `admin`/`admin`).
   Create your own account and grant it GM locally (see [`STARTUP.md`](STARTUP.md)).
3. **Legacy password fallback.** Old unsalted `sha256(password + "pokefable")` hashes
   still authenticate once. On that successful login the server rewrites the hash to
   scrypt (`salt:hash`) and never stores the legacy form again.
4. **CORS / WebSocket origin.** Allowed origins are `https://play.pokeverse.quest` and
   localhost. Extra hosts go in `PV_ORIGINS` (comma-separated). Requests from other
   origins are rejected. There is a connection cap (`PV_MAX_CONEXOES`, default 128).
5. **Dependency advisories.** `npm audit` reports Vite dev-server advisories. Run
   `npm audit fix` or bump Vite; the Vite dev server is not meant to be public anyway —
   use `npm run build` + a real static host for production.

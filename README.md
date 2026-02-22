# FTC MVP (Next.js + Supabase)

Webapp MVP mobile-first (user) e tablet-first (merchant) per pagamenti in token con clearing settimanale.

## Stack
- Next.js App Router + TypeScript + Tailwind.
- Supabase Postgres + Auth + RLS + Realtime.
- API routes server-side.
- PDF clearing via `pdfkit`.

## Setup locale
1. Copia env:
   ```bash
   cp .env.example .env.local
   ```
2. Compila variabili:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `FTC_SESSION_TTL_SECONDS` (default 90)
3. Installa e avvia:
   ```bash
   npm install
   npm run dev
   ```

## Migrazioni Supabase (SQL Editor)
Esegui in ordine i file in `supabase/migrations`:
1. `001_schema.sql`
2. `002_rls_and_rpc.sql`
3. `003_seed.sql`

## Deploy Vercel
1. Importa repo su Vercel.
2. Imposta variabili env uguali a `.env.example`.
3. Deploy senza modifiche.

## Troubleshooting Vercel
Se il build fallisce con errore TypeScript su `pages/admin/index.tsx` (implicit `any`), questo repository include ora una pagina compatibile e tipizzata in `pages/admin/index.tsx` per evitare `noImplicitAny` in build Vercel.


## Query utili (MVP)
Promuovere utente ad admin:
```sql
update public.profiles set role = 'admin' where id = 'USER_UUID';
```

Associare utente a Merchant 1 come staff:
```sql
insert into public.merchant_staff (merchant_id, user_id, role)
values ('00000000-0000-0000-0000-000000000001', 'USER_UUID', 'staff')
on conflict (merchant_id, user_id) do update set role = excluded.role;

update public.profiles set role = 'merchant' where id = 'USER_UUID';
```

## Manual test checklist
- [ ] Signup/login utente da `/auth`, profilo e wallet creati.
- [ ] Top-up da `/topup` aggiorna saldo e `token_transactions` type `topup`.
- [ ] Merchant crea sessione da `/merchant/sell` con importo supportato.
- [ ] Importo non supportato restituisce `Fuori FTC`.
- [ ] User paga da `/pay` con session ID e conferma (`confirm_payment` atomica).
- [ ] Merchant vede update realtime `✅ Pagato`.
- [ ] Merchant invia richiesta clearing da `/merchant/clearing` (max 1/7gg).
- [ ] Admin approva/rifiuta/segna pagato su `/admin/clearing`.
- [ ] Download PDF clearing da admin e merchant.

## Nota di sicurezza
- Nessuna chiave segreta nel repo.
- Equivalenza euro-token mostrata solo in clearing merchant/admin.

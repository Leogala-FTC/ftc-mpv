# FTC MVP Skeleton

Questo progetto fornisce una base minimale per avviare la webapp FTC MVP. È una semplice applicazione **Next.js** con **TypeScript** e **Tailwind CSS** preconfigurati. La pagina principale mostra un messaggio di benvenuto, in modo da verificare che il deploy su Vercel funzioni correttamente invece di restituire un errore 404.

## Come utilizzare questa base

1. **Ambiente locale (opzionale)**: se desideri eseguire il progetto in locale, assicurati di avere installato Node.js. Posizionati nella cartella `ftc_mvp` e installa le dipendenze:

   ```bash
   npm install
   npm run dev
   ```

   L'applicazione sarà disponibile in sviluppo su `http://localhost:3000`.

2. **Deploy su Vercel**: per rendere la webapp accessibile online, carica l'intero contenuto della cartella `ftc_mvp` nel repository Git collegato a Vercel (puoi crearne uno nuovo o sostituire i file esistenti). Assicurati di configurare le variabili d'ambiente su Vercel (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FTC_SESSION_TTL_SECONDS`). Dopo il push, Vercel installerà le dipendenze e effettuerà il build automaticamente.

3. **Supabase**: all'interno della cartella `supabase/migrations` trovi lo script `001_schema.sql` contenente tutte le tabelle necessarie per la tua applicazione. Puoi eseguirlo nel SQL editor di Supabase come hai già fatto per popolare lo schema.

## Struttura dei file principali

- `pages/index.tsx` – La home page della webapp. Attualmente contiene un messaggio di benvenuto. Puoi sostituirlo con la logica e l'interfaccia della tua applicazione.
- `pages/_app.tsx` – Importa gli stili globali di Tailwind per tutte le pagine.
- `styles/globals.css` – File CSS che importa le direttive di Tailwind.
- `tailwind.config.js` e `postcss.config.js` – Configurazioni necessarie per Tailwind CSS.
- `supabase/migrations/001_schema.sql` – Script SQL con definizione delle tabelle e tipi per la base dati Supabase.
- `.env.example` – Un file di esempio con le variabili d'ambiente necessarie.

## Prossimi passi

Questa base è solo l'inizio. Per implementare le funzionalità descritte nella tua specifica (gestione utenti, merchant, admin, pagamenti e clearing) dovrai aggiungere le pagine e i componenti necessari e integrare Supabase lato client e server. Tuttavia, con questa struttura la tua applicazione non risulterà più in 404 e potrai procedere gradualmente allo sviluppo.
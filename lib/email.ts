import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.FTC_FROM_EMAIL ?? "FTC <noreply@ftc.example.com>";
const ADMIN_EMAIL = process.env.FTC_ADMIN_EMAIL ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ftc-mpv.vercel.app";

/* ── Notifica admin: nuova richiesta di ricarica ── */
export async function sendTopupRequestToAdmin({
  userName,
  userEmail,
  packageEur,
  tokens,
  causale,
}: {
  userName: string;
  userEmail: string;
  packageEur: number;
  tokens: number;
  causale: string;
}) {
  if (!ADMIN_EMAIL) return;
  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `🪙 Nuova richiesta di ricarica — €${packageEur} (${tokens} token)`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
        <h2 style="color:#4f46e5">FTC — Nuova richiesta di ricarica</h2>
        <p>Un utente ha richiesto una ricarica tramite bonifico:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600;width:40%">Utente</td>
              <td style="padding:8px 12px;background:#f9f9f9">${userName}</td></tr>
          <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600">Email</td>
              <td style="padding:8px 12px;background:#f9f9f9">${userEmail}</td></tr>
          <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600">Importo</td>
              <td style="padding:8px 12px;background:#f9f9f9">€${packageEur},00</td></tr>
          <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600">Token</td>
              <td style="padding:8px 12px;background:#f9f9f9;color:#4f46e5;font-weight:700">${tokens.toLocaleString("it-IT")} token</td></tr>
          <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600">Causale attesa</td>
              <td style="padding:8px 12px;background:#f9f9f9;font-family:monospace;font-size:13px">${causale}</td></tr>
        </table>
        <p>Verifica il bonifico e approva o rifiuta dalla dashboard admin:</p>
        <a href="${APP_URL}/admin" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:8px">
          Vai alla Dashboard Admin →
        </a>
        <p style="color:#999;font-size:12px;margin-top:32px">FTC — Foligno Token Club</p>
      </div>`,
  });
}

/* ── Notifica utente: ricarica approvata ── */
export async function sendTopupApproved({
  userEmail,
  userName,
  tokens,
  packageEur,
}: {
  userEmail: string;
  userName: string;
  tokens: number;
  packageEur: number;
}) {
  await resend.emails.send({
    from: FROM,
    to: userEmail,
    subject: `✅ Ricarica approvata — ${tokens.toLocaleString("it-IT")} token accreditati!`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
        <h2 style="color:#16a34a">FTC — Ricarica approvata!</h2>
        <p>Ciao ${userName},</p>
        <p>La tua richiesta di ricarica da <strong>€${packageEur},00</strong> è stata approvata.</p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:20px 0;text-align:center">
          <p style="margin:0;color:#15803d;font-size:14px;font-weight:600">SALDO AGGIUNTO</p>
          <p style="margin:8px 0 0;font-size:36px;font-weight:800;color:#16a34a">
            +${tokens.toLocaleString("it-IT")} token
          </p>
        </div>
        <p>Puoi usarli subito per i tuoi acquisti nei negozi convenzionati FTC.</p>
        <a href="${APP_URL}/user/wallet" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:8px">
          Vedi il mio wallet →
        </a>
        <p style="color:#999;font-size:12px;margin-top:32px">FTC — Foligno Token Club</p>
      </div>`,
  });
}

/* ── Notifica utente: ricarica rifiutata ── */
export async function sendTopupRejected({
  userEmail,
  userName,
  packageEur,
}: {
  userEmail: string;
  userName: string;
  packageEur: number;
}) {
  await resend.emails.send({
    from: FROM,
    to: userEmail,
    subject: `❌ Richiesta di ricarica non approvata`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
        <h2 style="color:#dc2626">FTC — Ricarica non approvata</h2>
        <p>Ciao ${userName},</p>
        <p>La tua richiesta di ricarica da <strong>€${packageEur},00</strong> non è stata approvata.</p>
        <p>Possibili motivi:</p>
        <ul>
          <li>Il bonifico non è ancora arrivato</li>
          <li>La causale del bonifico era errata o mancante</li>
          <li>L'importo non corrispondeva al pacchetto selezionato</li>
        </ul>
        <p>Puoi riprovare dalla pagina di ricarica oppure contattare il supporto.</p>
        <a href="${APP_URL}/user/topup" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:8px">
          Riprova →
        </a>
        <p style="color:#999;font-size:12px;margin-top:32px">FTC — Foligno Token Club</p>
      </div>`,
  });
}

import Link from "next/link";

export default function Landing() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-ftc-viola">FTC MVP</h1>
      <p>Wallet token per utenti e merchant.</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link className="btn-primary text-center" href="/auth">Accedi Utente</Link>
        <Link className="btn-secondary text-center" href="/merchant/login">Accedi Merchant</Link>
      </div>
    </div>
  );
}

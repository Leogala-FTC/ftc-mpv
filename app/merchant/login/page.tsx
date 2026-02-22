import Link from "next/link";

export default function MerchantLogin() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Accesso Merchant</h1>
      <p>Per MVP usa login da /auth e assegna ruolo merchant via SQL.</p>
      <Link href="/auth" className="btn-primary inline-block">Vai al login</Link>
    </div>
  );
}

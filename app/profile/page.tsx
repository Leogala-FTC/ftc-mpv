import { requireUser } from "@/lib/auth";

export default async function ProfilePage() {
  const { user, profile } = await requireUser();
  return (
    <div className="space-y-2 card">
      <h1 className="text-2xl font-bold">Profilo</h1>
      <p>ID: {user.id}</p>
      <p>Nome: {profile?.name}</p>
      <p>Ruolo: {profile?.role}</p>
    </div>
  );
}

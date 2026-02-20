import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import supabase from '../lib/supabaseClient';

/**
 * Pagina di onboarding iniziale.
 *
 * Richiede all'utente di inserire le proprie informazioni di base e scegliere
 * se operare come utente o come merchant. Le informazioni aggiuntive per
 * merchant permettono di catalogare correttamente l'azienda (P.IVA, indirizzo,
 * settore, ecc.). Dopo la compilazione viene invocata la funzione
 * `complete_onboarding` e vengono aggiornati i campi aggiuntivi su profili e
 * merchants. Infine l'utente viene reindirizzato alla dashboard corretta.
 */
export default function Onboarding() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [role, setRole] = useState<'user' | 'merchant'>('user');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');

  // merchant-specific fields
  const [merchantName, setMerchantName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [vat, setVat] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [ateco, setAteco] = useState('');
  const [pec, setPec] = useState('');
  const [sdi, setSdi] = useState('');
  const [address, setAddress] = useState('');
  const [cap, setCap] = useState('');
  const [phoneBiz, setPhoneBiz] = useState('');
  const [website, setWebsite] = useState('');
  const [sector, setSector] = useState('');
  const [subsector, setSubsector] = useState('');
  const [description, setDescription] = useState('');
  const [iban, setIban] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data: profileRow, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error || !profileRow) {
        setLoading(false);
        return;
      }
      setProfile(profileRow);
      // se profilo già onboarded reindirizza
      if (profileRow.onboarded) {
        if (profileRow.role === 'user') router.replace('/user');
        else if (profileRow.role === 'merchant') router.replace('/merchant');
        else if (profileRow.role === 'admin') router.replace('/admin');
        return;
      }
      setName(profileRow.name || '');
      setPhone(profileRow.phone || '');
      setCity(profileRow.city || '');
      setProvince(profileRow.province || '');
      setRole(profileRow.role === 'merchant' ? 'merchant' : 'user');
      setLoading(false);
    }
    loadProfile();
  }, [router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // 1) Invoca RPC per completare onboarding e creare merchant se necessario
      const { error: rpcError } = await supabase.rpc('complete_onboarding', {
        p_role: role,
        p_name: name,
        p_merchant_name: role === 'merchant' ? merchantName || legalName || name : null,
      });
      if (rpcError) throw rpcError;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utente non autenticato');
      // 2) Aggiorna profilo con campi extra
      const updates: any = {
        phone,
        city,
        province,
      };
      await supabase.from('profiles').update(updates).eq('id', user.id);
      if (role === 'merchant') {
        // recupera merchant_id dal collegamento staff
        const { data: staffRows } = await supabase
          .from('merchant_staff')
          .select('merchant_id')
          .eq('user_id', user.id);
        const merchantId = staffRows && staffRows.length ? staffRows[0].merchant_id : null;
        if (merchantId) {
          const merchantUpdates: any = {
            name: merchantName || legalName || name,
            legal_name: legalName || null,
            vat_number: vat || null,
            tax_code: taxCode || null,
            ateco_code: ateco || null,
            pec: pec || null,
            sdi_code: sdi || null,
            address,
            cap,
            phone: phoneBiz || null,
            website: website || null,
            city: city,
            province: province,
            sector: sector || null,
            subsector: subsector || null,
            description: description || null,
            iban: iban || null,
          };
          await supabase.from('merchants').update(merchantUpdates).eq('id', merchantId);
        }
      }
      // Dopo salvataggio reindirizza alla dashboard
      if (role === 'merchant') router.replace('/merchant');
      else router.replace('/user');
    } catch (err: any) {
      setError(err.message || 'Errore durante il salvataggio.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Caricamento…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Completa il profilo</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nome completo</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Telefono</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Città</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Provincia</label>
            <input
              type="text"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Ruolo</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'user' | 'merchant')}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          >
            <option value="user">User (Cliente)</option>
            <option value="merchant">Merchant (Esercente)</option>
          </select>
        </div>
        {role === 'merchant' && (
          <div className="space-y-4 p-4 bg-gray-50 rounded">
            <h2 className="text-xl font-semibold mb-2">Dati aziendali</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome attività</label>
              <input
                type="text"
                required
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Ragione sociale</label>
              <input
                type="text"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Partita IVA</label>
                <input
                  type="text"
                  value={vat}
                  onChange={(e) => setVat(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Codice fiscale</label>
                <input
                  type="text"
                  value={taxCode}
                  onChange={(e) => setTaxCode(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Codice ATECO</label>
                <input
                  type="text"
                  value={ateco}
                  onChange={(e) => setAteco(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">PEC</label>
                <input
                  type="email"
                  value={pec}
                  onChange={(e) => setPec(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Codice SDI</label>
              <input
                type="text"
                value={sdi}
                onChange={(e) => setSdi(e.target.value)}
                className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Indirizzo (via, numero, città)</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">CAP</label>
                <input
                  type="text"
                  value={cap}
                  onChange={(e) => setCap(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Telefono aziendale</label>
                <input
                  type="tel"
                  value={phoneBiz}
                  onChange={(e) => setPhoneBiz(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Sito web / Social</label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Settore</label>
                <input
                  type="text"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Sottosettore</label>
                <input
                  type="text"
                  value={subsector}
                  onChange={(e) => setSubsector(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Descrizione attività</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">IBAN</label>
              <input
                type="text"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>
          </div>
        )}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          className="bg-green-600 text-white py-2 px-6 rounded hover:bg-green-700"
          disabled={saving}
        >
          {saving ? 'Salvataggio…' : 'Completa'}
        </button>
      </form>
    </div>
  );
}
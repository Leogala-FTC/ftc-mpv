import { useEffect, useState } from 'react';
import supabase from '../../lib/supabaseClient';
import Link from 'next/link';
import jsPDF from 'jspdf';

interface ClearingRequest {
  id: string;
  merchant_id: string;
  requested_tokens: number;
  eur_estimate: number;
  status: string;
  created_at: string;
  merchant?: { name: string };
}

/**
 * Admin clearing management page
 *
 * Lists pending clearing requests and allows admins to approve, reject or
 * mark them as paid. Requests that are already paid are hidden from the
 * list.
 */
export default function AdminClearing() {
  const [requests, setRequests] = useState<ClearingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  async function fetchRequests() {
    try {
      const { data, error } = await supabase
        .from('clearing_requests')
        .select('id, merchant_id, requested_tokens, eur_estimate, status, created_at, merchants(name)')
        .neq('status', 'paid');
      if (error) throw error;
      setRequests(data as ClearingRequest[]);
    } catch (err: any) {
      setError(err.message || 'Errore nel recuperare le richieste');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRequests();
  }, []);

  async function handleAction(id: string, newStatus: 'approved' | 'rejected' | 'paid') {
    setActionError(null);
    setActionSuccess(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Utente non connesso');
      const update: any = { status: newStatus };
      const now = new Date().toISOString();
      if (newStatus === 'approved') {
        update.approved_by = user.id;
        update.approved_at = now;
      } else if (newStatus === 'rejected') {
        update.rejected_by = user.id;
        update.rejected_at = now;
      } else if (newStatus === 'paid') {
        update.paid_by = user.id;
        update.paid_at = now;
      }
      const { error } = await supabase.from('clearing_requests').update(update).eq('id', id);
      if (error) throw error;
      setActionSuccess(`Richiesta ${id} aggiornata con stato ${newStatus}`);
      fetchRequests();
    } catch (err: any) {
      setActionError(err.message || 'Errore nell’aggiornare la richiesta');
    }
  }

  function downloadPdf(req: ClearingRequest) {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('FTC MVP - Rendiconto Clearing', 14, 18);
    doc.setFontSize(11);
    doc.text(`ID richiesta: ${req.id}`, 14, 30);
    doc.text(`Merchant: ${req.merchant?.name || req.merchant_id}`, 14, 38);
    doc.text(`Token richiesti: ${req.requested_tokens.toFixed(2)}`, 14, 46);
    doc.text(`Euro stimati: ${req.eur_estimate.toFixed(2)}`, 14, 54);
    doc.text(`Stato: ${req.status}`, 14, 62);
    doc.text(`Creato il: ${new Date(req.created_at).toLocaleString()}`, 14, 70);
    doc.text('Documento non fiscale (MVP).', 14, 86);
    doc.save(`clearing_${req.id}.pdf`);
  }

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-4">Gestione Clearing</h1>
      {loading && <p>Caricamento…</p>}
      {error && <p className="text-red-600 mb-4">{error}</p>}
      {actionError && <p className="text-red-600 mb-4">{actionError}</p>}
      {actionSuccess && <p className="text-green-600 mb-4">{actionSuccess}</p>}
      {!loading && !error && requests.length === 0 && <p>Nessuna richiesta pendente.</p>}
      {!loading && !error && requests.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left">Merchant</th>
                <th className="px-4 py-2 text-left">Token</th>
                <th className="px-4 py-2 text-left">€ stimati</th>
                <th className="px-4 py-2 text-left">Stato</th>
                <th className="px-4 py-2 text-left">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {requests.map((req) => (
                <tr key={req.id}>
                  <td className="px-4 py-2">{req.merchant?.name || req.merchant_id}</td>
                  <td className="px-4 py-2">{req.requested_tokens.toFixed(2)}</td>
                  <td className="px-4 py-2">{req.eur_estimate.toFixed(2)}</td>
                  <td className="px-4 py-2 capitalize">{req.status}</td>
                  <td className="px-4 py-2 space-x-2">
                    <button
                      onClick={() => downloadPdf(req)}
                      className="text-gray-700 hover:underline"
                    >
                      PDF
                    </button>
                    {req.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleAction(req.id, 'approved')}
                          className="text-green-600 hover:underline"
                        >
                          Approva
                        </button>
                        <button
                          onClick={() => handleAction(req.id, 'rejected')}
                          className="text-red-600 hover:underline"
                        >
                          Rifiuta
                        </button>
                      </>
                    )}
                    {req.status === 'approved' && (
                      <button
                        onClick={() => handleAction(req.id, 'paid')}
                        className="text-blue-600 hover:underline"
                      >
                        Segna pagato
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-6">
        <Link href="/" className="text-blue-600 hover:underline">
          Torna alla home
        </Link>
      </div>
    </div>
  );
}
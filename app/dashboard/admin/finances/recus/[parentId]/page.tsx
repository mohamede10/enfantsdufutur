//app\dashboard\admin\finances\recus\[parentId]\page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, User, Mail, Phone, Wallet, 
  Receipt, Calendar, Loader2, Printer,
  FileText, Download, ChevronDown, ChevronUp,
  RefreshCw, Search
} from "lucide-react";
import RecuPaiement from "@/components/RecuPaiement";

interface RecuDetail {
  numero_recu: string;
  date_paiement: string;
  enfant: string;
  montant: number;
  mode_paiement: string;
  type_frais: string;
  reference: string;
  classe: string;
  montant_total: number;
  reste_a_payer: number;
  source: string;
  source_id: number;
  preinscription_id: number | null;
}

interface ParentInfo {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  adresse: string;
}

export default function ParentRecusDetailPage() {
  const params = useParams();
  const router = useRouter();
  const parentId = params.parentId as string;

  const [parent, setParent] = useState<ParentInfo | null>(null);
  const [recus, setRecus] = useState<RecuDetail[]>([]);
  const [statistiques, setStatistiques] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [annee, setAnnee] = useState(new Date().getFullYear().toString());
  const [selectedRecu, setSelectedRecu] = useState<RecuDetail | null>(null);
  const [showRecuModal, setShowRecuModal] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (parentId) {
      fetchParentRecus();
    }
  }, [parentId, annee]);

  const fetchParentRecus = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/recus/parents/${parentId}?annee=${annee}`);
      if (response.ok) {
        const data = await response.json();
        setParent(data.parent);
        setRecus(data.recus);
        setStatistiques(data.statistiques);
      }
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecus = search
    ? recus.filter(r =>
        r.enfant?.toLowerCase().includes(search.toLowerCase()) ||
        r.numero_recu?.toLowerCase().includes(search.toLowerCase()) ||
        r.reference?.toLowerCase().includes(search.toLowerCase())
      )
    : recus;

  const totalMontant = filteredRecus.reduce((acc, r) => acc + Number(r.montant), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec retour */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/admin/finances/recus"
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <User className="w-6 h-6 text-blue-600" />
              {parent?.prenom} {parent?.nom}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Tous les reçus de la famille
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={annee}
            onChange={(e) => setAnnee(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {["2024", "2025", "2026", "2027"].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <button
            onClick={fetchParentRecus}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Infos parent */}
      {parent && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500">Nom complet</p>
              <p className="font-semibold">{parent.prenom} {parent.nom}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-semibold">{parent.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Téléphone</p>
              <p className="font-semibold">{parent.telephone || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Adresse</p>
              <p className="font-semibold">{parent.adresse || '-'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Statistiques */}
      {statistiques && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <p className="text-sm text-blue-700 font-medium">Total reçus</p>
            <p className="text-2xl font-bold text-blue-900">{statistiques.total_recus}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4 border border-green-100">
            <p className="text-sm text-green-700 font-medium">Montant payé</p>
            <p className="text-2xl font-bold text-green-900">
              {statistiques.total_montant.toLocaleString()} GNF
            </p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-100">
            <p className="text-sm text-yellow-700 font-medium">Montant total</p>
            <p className="text-2xl font-bold text-yellow-900">
              {statistiques.total_montant_total.toLocaleString()} GNF
            </p>
          </div>
          <div className="bg-red-50 rounded-xl p-4 border border-red-100">
            <p className="text-sm text-red-700 font-medium">Reste à payer</p>
            <p className="text-2xl font-bold text-red-900">
              {statistiques.total_reste.toLocaleString()} GNF
            </p>
          </div>
        </div>
      )}

      {/* Recherche */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par élève, N° reçu ou référence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Liste des reçus */}
      {filteredRecus.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Aucun reçu trouvé</p>
          <p className="text-sm text-gray-400 mt-1">Aucun paiement enregistré pour ce parent</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Reçu</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Élève</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classe</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Montant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRecus.map((recu) => (
                    <tr key={`${recu.source}-${recu.source_id}`} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded font-semibold">
                          {recu.numero_recu}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">{recu.enfant || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{recu.classe || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                          {recu.type_frais}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">
                        {Number(recu.montant).toLocaleString()} GNF
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {recu.mode_paiement === 'especes' ? 'Espèces' :
                         recu.mode_paiement === 'orange_money' ? 'Orange Money' :
                         recu.mode_paiement || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {recu.date_paiement ? new Date(recu.date_paiement).toLocaleDateString('fr-FR') : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            setSelectedRecu(recu);
                            setShowRecuModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-700 transition font-medium"
                        >
                          <Printer className="w-3 h-3" />
                          Imprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 font-bold text-gray-700">
                      Total ({filteredRecus.length} reçus)
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-700">
                      {totalMontant.toLocaleString()} GNF
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <p className="text-sm text-gray-500">
              {filteredRecus.length} reçu{filteredRecus.length > 1 ? 's' : ''} trouvé{filteredRecus.length > 1 ? 's' : ''}
            </p>
          </div>
        </>
      )}

      {/* Modal Reçu */}
      {selectedRecu && showRecuModal && (
        <RecuPaiement
          recu={{
            numero_recu: selectedRecu.numero_recu,
            date_paiement: selectedRecu.date_paiement,
            enfant: selectedRecu.enfant,
            montant: selectedRecu.montant,
            mode_paiement: selectedRecu.mode_paiement,
            type_frais: selectedRecu.type_frais,
            reference: selectedRecu.reference,
            classe: selectedRecu.classe,
            parent_nom: `${parent?.prenom} ${parent?.nom}`,
            parent_email: parent?.email || '',
            source: selectedRecu.source,
            montant_total: selectedRecu.montant_total,
            reste_a_payer: selectedRecu.reste_a_payer,
            preinscription_id: selectedRecu.preinscription_id || undefined,
            paiement_id: selectedRecu.source_id
          }}
          onClose={() => {
            setShowRecuModal(false);
            setSelectedRecu(null);
          }}
        />
      )}
    </div>
  );
}
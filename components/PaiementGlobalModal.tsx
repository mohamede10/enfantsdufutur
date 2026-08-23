// components/PaiementGlobalModal.tsx
"use client";

import { useState } from "react";
import { X, Loader2, Wallet, Smartphone, CreditCard, CheckCircle, AlertTriangle, Percent, TrendingUp } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  soldeRestant: number;
  parentId?: number; // Facultatif: utilisé par l'admin. Si non fourni, l'API utilise le parent connecté.
}

const formatMontant = (montant: number): string => {
  return Math.round(Math.max(0, montant)).toLocaleString();
};

export default function PaiementGlobalModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  soldeRestant,
  parentId
}: Props) {
  const [paying, setPaying] = useState(false);
  const [montantSaisi, setMontantSaisi] = useState<string>(soldeRestant > 0 ? soldeRestant.toString() : "");
  const [modePaiement, setModePaiement] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handlePaiement = async () => {
    const montant = parseInt(montantSaisi.replace(/\s/g, ''));
    
    if (!montant || montant <= 0) {
      setError("Veuillez saisir un montant valide");
      return;
    }

    if (soldeRestant > 0 && montant > soldeRestant) {
      setError(`Le montant (${formatMontant(montant)}) dépasse le solde global restant (${formatMontant(soldeRestant)})`);
      return;
    }

    if (!modePaiement) {
      setError("Veuillez sélectionner un mode de paiement");
      return;
    }

    setPaying(true);
    setError(null);
    
    try {
      const payload: any = {
        montant,
        modePaiement,
        reference: reference || null,
      };
      
      if (parentId) {
        payload.parentId = parentId;
      }

      const response = await fetch("/api/parent/paiement-global", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess();
        setModePaiement("");
        setReference("");
        onClose();
      } else {
        setError(data.error || "Erreur lors du paiement");
      }
    } catch (error) {
      console.error("Erreur:", error);
      setError("Erreur lors du paiement");
    } finally {
      setPaying(false);
    }
  };

  const handleSuggestion = (pourcentage: number) => {
    const montantSuggere = Math.round(soldeRestant * (pourcentage / 100));
    setMontantSaisi(montantSuggere.toString());
  };

  const handlePayerSolde = () => {
    setMontantSaisi(soldeRestant.toString());
  };

  if (!isOpen) return null;

  const montantSaisiNumber = parseInt(montantSaisi.replace(/\s/g, '')) || 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-black">Paiement Global</h2>
              <p className="text-sm text-gray-600">Payez pour l'ensemble de vos enfants inscrits</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-50 p-4 rounded-lg text-red-700 mb-6 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <p>{error}</p>
            </div>
          )}

          {/* RÉCAPITULATIF */}
          <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-100 flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600">Solde global restant à payer</p>
              <p className="text-3xl font-bold text-blue-700">{formatMontant(soldeRestant)} GNF</p>
            </div>
            <Wallet className="w-12 h-12 text-blue-200" />
          </div>

          {soldeRestant > 0 ? (
            <>
              {/* SUGGESTIONS DE MONTANT */}
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-medium mb-2">
                  Suggestions de montant
                </label>
                <div className="flex flex-wrap gap-2">
                  {[25, 50, 75].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => handleSuggestion(pct)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-indigo-100 rounded-lg text-sm font-medium text-gray-700 hover:text-indigo-700 transition flex items-center gap-1"
                    >
                      <Percent className="w-3 h-3" />
                      {pct}%
                    </button>
                  ))}
                  <button
                    onClick={handlePayerSolde}
                    className="px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 rounded-lg text-sm font-medium text-indigo-700 transition flex items-center gap-1"
                  >
                    <TrendingUp className="w-3 h-3" />
                    Payer le solde
                  </button>
                </div>
              </div>

              {/* CHAMP DE SAISIE DU MONTANT */}
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-medium mb-2">
                  Montant à payer * <span className="text-gray-400 text-xs">(saisie libre)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">GNF</span>
                  <input
                    type="text"
                    value={montantSaisi}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, '');
                      const formatted = cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
                      setMontantSaisi(formatted);
                    }}
                    placeholder="Ex: 1 500 000"
                    className="w-full pl-16 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black text-lg font-medium"
                  />
                </div>
                {montantSaisiNumber > 0 && montantSaisiNumber > soldeRestant && (
                  <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Le montant saisi dépasse le solde global restant ({formatMontant(soldeRestant)} GNF)
                  </p>
                )}
                {montantSaisiNumber > 0 && montantSaisiNumber <= soldeRestant && (
                  <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Il restera à payer: {formatMontant(soldeRestant - montantSaisiNumber)} GNF
                  </p>
                )}
              </div>

              {/* MODE DE PAIEMENT */}
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-medium mb-2">Mode de paiement *</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'especes', label: 'Espèces', icon: Wallet, color: 'green' },
                    { value: 'orange_money', label: 'Orange Money', icon: Smartphone, color: 'orange' },
                    { value: 'carte', label: 'Carte Visa', icon: CreditCard, color: 'blue' }
                  ].map(({ value, label, icon: Icon, color }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setModePaiement(value)}
                      className={`p-3 border rounded-lg flex flex-col items-center gap-2 transition ${
                        modePaiement === value
                          ? `border-${color}-500 bg-${color}-50`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Icon className={`w-6 h-6 text-${color}-600`} />
                      <span className="text-xs text-black font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* RÉFÉRENCE DE TRANSACTION */}
              {(modePaiement === 'orange_money' || modePaiement === 'carte') && (
                <div className="mb-6">
                  <label className="block text-gray-700 mb-2 text-sm font-medium">Numéro de transaction</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder={modePaiement === 'orange_money' ? 'Ex: #OM-123456789' : 'Ex: VISA-****-1234'}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {modePaiement === 'orange_money'
                      ? 'Entrez le numéro de transaction reçu par SMS'
                      : 'Entrez le numéro de transaction de votre carte'}
                  </p>
                </div>
              )}

              {modePaiement === 'especes' && (
                <div className="bg-yellow-50 p-3 rounded-lg text-center mb-6">
                  <p className="text-sm text-yellow-700">
                    Paiement en espèces à effectuer à la caisse de l'école.
                    Un email sera envoyé au comptable pour validation.
                  </p>
                </div>
              )}

              {/* BOUTON DE PAIEMENT */}
              <button
                onClick={handlePaiement}
                disabled={
                  !modePaiement || 
                  paying || 
                  montantSaisiNumber <= 0 ||
                  montantSaisiNumber > soldeRestant
                }
                className={`w-full py-3 rounded-lg font-semibold transition ${
                  !modePaiement || 
                  paying || 
                  montantSaisiNumber <= 0 ||
                  montantSaisiNumber > soldeRestant
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {paying ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                    Traitement...
                  </>
                ) : (
                  `Payer ${montantSaisi ? formatMontant(montantSaisiNumber) : '0'} GNF`
                )}
              </button>
            </>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Tous vos paiements sont à jour</h3>
              <p className="text-gray-500">Vous n'avez aucun solde restant à payer pour vos enfants.</p>
              <button
                onClick={onClose}
                className="mt-6 px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

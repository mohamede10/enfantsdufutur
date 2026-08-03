"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Printer, GraduationCap, Users, FileText } from "lucide-react";

export default function BulletinsDirecteurPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClasse, setSelectedClasse] = useState("");
  
  const [bulletins, setBulletins] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const printRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Classes
  useEffect(() => {
    fetch("/api/directeur_etudes/bulletins?action=classes")
      .then(res => res.json())
      .then(data => {
        if(Array.isArray(data)) setClasses(data);
      })
      .catch(console.error);
  }, []);

  // 2. Fetch Bulletins
  useEffect(() => {
    if (!selectedClasse) {
      setBulletins([]);
      return;
    }
    setLoading(true);
    setError("");
    fetch(`/api/directeur_etudes/bulletins?action=bulletins&classe_id=${selectedClasse}`)
      .then(res => res.json())
      .then(data => {
        if(Array.isArray(data)) {
          setBulletins(data);
        } else {
          setError(data.error || "Erreur lors du chargement des bulletins.");
        }
      })
      .catch(() => setError("Erreur de connexion."))
      .finally(() => setLoading(false));
  }, [selectedClasse]);

  const handlePrint = () => {
    window.print();
  };

  const getMention = (moyenne: number) => {
    if (moyenne >= 16) return "Très Bien";
    if (moyenne >= 14) return "Bien";
    if (moyenne >= 12) return "Assez Bien";
    if (moyenne >= 10) return "Passable";
    return "Insuffisant";
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto print:p-0 print:m-0 print:max-w-none">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600" />
          Bulletins Scolaires
        </h1>
        <p className="text-gray-500 mt-1">Générez et imprimez les bulletins des élèves par classe.</p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-6 items-end print:hidden">
        <div className="flex-1 min-w-[250px]">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            Classe
          </label>
          <select
            value={selectedClasse}
            onChange={(e) => setSelectedClasse(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white transition-colors"
          >
            <option value="">Sélectionner une classe</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.nom} ({c.niveau})</option>
            ))}
          </select>
        </div>

        {bulletins.length > 0 && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition"
          >
            <Printer className="w-5 h-5" />
            Tout imprimer
          </button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center p-12 print:hidden">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl print:hidden">
          {error}
        </div>
      )}

      {!loading && selectedClasse && bulletins.length === 0 && !error && (
        <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 print:hidden">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Aucun bulletin disponible</h3>
          <p className="text-gray-500 mt-1">Vérifiez que les élèves sont inscrits et qu'ils ont des notes.</p>
        </div>
      )}

      {/* Zone d'impression */}
      <div ref={printRef} className="space-y-12">
        {bulletins.map((bulletin) => (
          <div key={bulletin.eleve.id} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 print:shadow-none print:border-none print:break-inside-avoid print:p-0">
            <div className="text-center mb-8 border-b-2 border-gray-900 pb-6">
              <h1 className="text-2xl font-bold uppercase tracking-wider text-gray-900">École Internationale l'Enfant Futur</h1>
              <p className="text-gray-600 mt-1">Excellence - Discipline - Travail</p>
              <h2 className="text-xl font-bold mt-4 uppercase underline underline-offset-4 text-blue-900">Bulletin de Notes</h2>
            </div>

            <div className="flex justify-between items-end mb-8 bg-gray-50 p-4 rounded-xl print:bg-transparent print:p-0">
              <div className="space-y-2">
                <p><span className="font-semibold text-gray-700">Élève:</span> <span className="font-bold text-lg text-gray-900">{bulletin.eleve.nom} {bulletin.eleve.prenom}</span></p>
                <p><span className="font-semibold text-gray-700">Matricule:</span> {bulletin.eleve.matricule}</p>
                <p><span className="font-semibold text-gray-700">Classe:</span> {classes.find(c => c.id === parseInt(selectedClasse))?.nom}</p>
              </div>
              <div className="text-right space-y-2">
                <p><span className="font-semibold text-gray-700">Effectif:</span> {bulletin.totalEleves}</p>
                <p><span className="font-semibold text-gray-700">Année Scolaire:</span> 2025-2026</p>
              </div>
            </div>

            <table className="w-full text-left border-collapse border border-gray-900 mb-6">
              <thead className="bg-gray-100 print:bg-gray-100">
                <tr className="border-b border-gray-900 text-gray-900">
                  <th className="p-3 border-r border-gray-900 font-bold uppercase">Matière</th>
                  <th className="p-3 border-r border-gray-900 font-bold text-center w-24">Coeff</th>
                  <th className="p-3 border-r border-gray-900 font-bold text-center w-32">Moyenne (/20)</th>
                  <th className="p-3 border-r border-gray-900 font-bold text-center w-32">N. Pondérée</th>
                  <th className="p-3 font-bold">Professeur</th>
                </tr>
              </thead>
              <tbody>
                {bulletin.matieres.map((m: any, idx: number) => (
                  <tr key={idx} className="border-b border-gray-900 text-sm">
                    <td className="p-3 border-r border-gray-900 font-semibold">{m.matiere}</td>
                    <td className="p-3 border-r border-gray-900 text-center">{m.coefficient}</td>
                    <td className="p-3 border-r border-gray-900 text-center font-bold {m.moyenne < 10 ? 'text-red-600' : 'text-green-600'}">
                      {m.moyenne.toFixed(2)}
                    </td>
                    <td className="p-3 border-r border-gray-900 text-center">{(m.moyenne * m.coefficient).toFixed(2)}</td>
                    <td className="p-3 text-gray-600">{m.enseignant}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid grid-cols-2 gap-8 mt-8">
              <div className="border-2 border-gray-900 p-4 rounded-xl bg-gray-50 print:bg-transparent">
                <h3 className="font-bold text-gray-900 uppercase border-b border-gray-300 pb-2 mb-3">Bilan du Travail</h3>
                <div className="space-y-3">
                  <p className="flex justify-between text-lg"><span className="font-semibold">Moyenne Générale:</span> <span className={`font-bold ${bulletin.moyenneGenerale >= 10 ? 'text-green-600' : 'text-red-600'}`}>{bulletin.moyenneGenerale.toFixed(2)} / 20</span></p>
                  <p className="flex justify-between text-lg"><span className="font-semibold">Rang:</span> <span className="font-bold">{bulletin.rang} {bulletin.rang === 1 ? 'er' : 'ème'} / {bulletin.totalEleves}</span></p>
                  <p className="flex justify-between text-lg"><span className="font-semibold">Mention:</span> <span className="font-bold uppercase">{getMention(bulletin.moyenneGenerale)}</span></p>
                </div>
              </div>
              
              <div className="border-2 border-gray-900 p-4 rounded-xl flex flex-col justify-between h-40">
                <h3 className="font-bold text-gray-900 uppercase">Le Directeur des Études</h3>
                <div className="text-right mt-auto">
                  <p className="text-gray-400 italic">Signature et cachet</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* CSS d'impression injecté */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:max-w-none {
            max-width: none !important;
          }
          .space-y-12 > div {
            page-break-after: always;
            visibility: visible;
          }
          .space-y-12 > div * {
            visibility: visible;
          }
          .space-y-12 {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}} />
    </div>
  );
}

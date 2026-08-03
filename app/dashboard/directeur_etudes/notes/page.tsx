"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, AlertCircle, CheckCircle2,FileText , GraduationCap, BookOpen, Users } from "lucide-react";

export default function NotesDirecteurPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClasse, setSelectedClasse] = useState("");
  
  const [enseignements, setEnseignements] = useState<any[]>([]);
  const [selectedEnseignement, setSelectedEnseignement] = useState("");
  
  const [eleves, setEleves] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [notesForm, setNotesForm] = useState<Record<string, any>>({});

  // 1. Fetch Classes
  useEffect(() => {
    fetch("/api/directeur_etudes/notes?action=classes")
      .then(res => res.json())
      .then(data => {
        if(Array.isArray(data)) setClasses(data);
      })
      .catch(console.error);
  }, []);

  // 2. Fetch Enseignements when Class selected
  useEffect(() => {
    if (!selectedClasse) {
      setEnseignements([]);
      setSelectedEnseignement("");
      setEleves([]);
      return;
    }
    setLoading(true);
    fetch(`/api/directeur_etudes/notes?action=enseignements&classe_id=${selectedClasse}`)
      .then(res => res.json())
      .then(data => {
        if(Array.isArray(data)) setEnseignements(data);
        setSelectedEnseignement("");
        setEleves([]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedClasse]);

  // 3. Fetch Eleves and Notes when Enseignement selected
  useEffect(() => {
    if (!selectedEnseignement) {
      setEleves([]);
      return;
    }
    setLoading(true);
    fetch(`/api/directeur_etudes/notes?action=eleves_et_notes&classe_id=${selectedClasse}&enseignement_id=${selectedEnseignement}`)
      .then(res => res.json())
      .then(data => {
        if(Array.isArray(data)) {
          setEleves(data);
          // Initialize form state
          const initialForm: Record<string, any> = {};
          data.forEach(eleve => {
            // Pre-fill with first existing note or empty
            const existing = eleve.notes[0] || {};
            initialForm[eleve.id] = {
              id: existing.id || null,
              eleve_id: eleve.id,
              valeur: existing.valeur !== undefined ? existing.valeur : "",
              coefficient: existing.coefficient || 1,
              type_note: existing.type_note || "Devoir",
              commentaire: existing.commentaire || ""
            };
          });
          setNotesForm(initialForm);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedEnseignement, selectedClasse]);

  const handleNoteChange = (eleveId: string, field: string, value: any) => {
    setNotesForm(prev => ({
      ...prev,
      [eleveId]: { ...prev[eleveId], [field]: value }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: "", text: "" });

    // Filter out rows where 'value' is empty (don't save empty notes)
    const notesToSave = Object.values(notesForm).filter(n => n.valeur !== "" && n.valeur !== null);

    try {
      const res = await fetch("/api/directeur_etudes/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enseignement_id: selectedEnseignement,
          notes: notesToSave
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Notes enregistrées avec succès." });
      } else {
        setMessage({ type: "error", text: data.error || "Erreur lors de l'enregistrement." });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Erreur de connexion." });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ type: "", text: "" }), 5000);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600" />
          Saisie des Notes
        </h1>
        <p className="text-gray-500 mt-1">Sélectionnez une classe et une matière pour gérer les notes des élèves.</p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-6 items-end">
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

        <div className="flex-1 min-w-[250px]">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Matière & Enseignant
          </label>
          <select
            value={selectedEnseignement}
            onChange={(e) => setSelectedEnseignement(e.target.value)}
            disabled={!selectedClasse || enseignements.length === 0}
            className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white transition-colors disabled:opacity-50"
          >
            <option value="">Sélectionner une matière</option>
            {enseignements.map(en => (
              <option key={en.id} value={en.id}>{en.matiere} - {en.enseignant}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      )}

      {!loading && eleves.length > 0 && selectedEnseignement && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-500" />
              Liste des Élèves ({eleves.length})
            </h3>
            
            <div className="flex items-center gap-3">
              {message.text && (
                <div className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${
                  message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {message.text}
                </div>
              )}
              
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition disabled:opacity-70"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Enregistrer les notes
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-100 text-sm text-gray-500 uppercase tracking-wider">
                  <th className="p-4 font-medium">Matricule</th>
                  <th className="p-4 font-medium">Nom & Prénom</th>
                  <th className="p-4 font-medium w-32">Note (/20)</th>
                  <th className="p-4 font-medium w-32">Coefficient</th>
                  <th className="p-4 font-medium w-40">Type</th>
                  <th className="p-4 font-medium">Appréciation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {eleves.map((eleve) => {
                  const form = notesForm[eleve.id] || {};
                  return (
                    <tr key={eleve.id} className="hover:bg-gray-50/50 transition">
                      <td className="p-4 text-sm font-medium text-gray-900">{eleve.matricule}</td>
                      <td className="p-4 text-sm text-gray-700">{eleve.nom} {eleve.prenom}</td>
                      <td className="p-4">
                        <input
                          type="number"
                          min="0"
                          max="20"
                          step="0.25"
                          value={form.valeur}
                          onChange={(e) => handleNoteChange(eleve.id, 'valeur', e.target.value)}
                          className="w-full p-2 text-center border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition"
                          placeholder="Ex: 15"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          min="1"
                          value={form.coefficient}
                          onChange={(e) => handleNoteChange(eleve.id, 'coefficient', e.target.value)}
                          className="w-full p-2 text-center border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition"
                        />
                      </td>
                      <td className="p-4">
                        <select
                          value={form.type_note}
                          onChange={(e) => handleNoteChange(eleve.id, 'type_note', e.target.value)}
                          className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition bg-white"
                        >
                          <option value="Devoir">Devoir</option>
                          <option value="Composition">Composition</option>
                          <option value="Interrogation">Interrogation</option>
                          <option value="Participation">Participation</option>
                        </select>
                      </td>
                      <td className="p-4">
                        <input
                          type="text"
                          value={form.commentaire}
                          onChange={(e) => handleNoteChange(eleve.id, 'commentaire', e.target.value)}
                          className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition"
                          placeholder="Optionnel"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {!loading && selectedClasse && selectedEnseignement && eleves.length === 0 && (
        <div className="bg-white p-12 text-center rounded-2xl border border-gray-100">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Aucun élève inscrit</h3>
          <p className="text-gray-500 mt-1">Il n'y a pas d'élèves inscrits dans cette classe actuellement.</p>
        </div>
      )}
    </div>
  );
}

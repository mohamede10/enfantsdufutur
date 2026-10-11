//app/dashboard/admin/librairie/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Store, Package, ShoppingCart, Tag, Search, Plus, Trash2, Edit, CreditCard, Box, Check, ImageIcon, X, Loader2, BookOpen,
  AlertTriangle
} from "lucide-react";
import Image from "next/image";

interface Article {
  id: number;
  nom: string;
  description: string;
  prix_unitaire: number;
  quantite_stock: number;
  categorie: string;
  image_url?: string | null;
}

interface Vente {
  id: number;
  article_nom: string;
  eleve_nom: string | null;
  quantite: number;
  montant_total: number;
  date_vente: string;
  vendeur: string;
}

export default function LibrairiePage() {
  const [activeTab, setActiveTab] = useState("articles");
  const [articles, setArticles] = useState<Article[]>([]);
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [eleves, setEleves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [showArticleForm, setShowArticleForm] = useState(false);
  const [showVenteForm, setShowVenteForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);

  const [articleData, setArticleData] = useState({
    nom: "", description: "", prix_unitaire: 0, quantite_stock: 0, categorie: "fourniture", image_url: ""
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [venteData, setVenteData] = useState({
    article_id: "", eleve_id: "", quantite: 1
  });
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // État pour le prix formaté (avec séparateur de milliers)
  const [prixFormate, setPrixFormate] = useState("");

  const [commandesCount, setCommandesCount] = useState({ total: 0, enAttente: 0 });

  // ⭐ États pour éviter la double soumission
  const [isSubmittingArticle, setIsSubmittingArticle] = useState(false);
  const [isSubmittingVente, setIsSubmittingVente] = useState(false);
  const [deletingArticleId, setDeletingArticleId] = useState<number | null>(null);
  const [deletingVenteId, setDeletingVenteId] = useState<number | null>(null);

  // ⭐⭐ NOUVEAU : État pour le modal de confirmation de suppression de vente
  const [venteToDelete, setVenteToDelete] = useState<Vente | null>(null);

  // ⭐⭐ NOUVEAU : État pour le modal de confirmation de suppression d'article
  const [articleToDelete, setArticleToDelete] = useState<Article | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resArticles, resVentes, resEleves, resCmd] = await Promise.all([
        fetch('/api/admin/librairie/articles'),
        fetch('/api/admin/librairie/ventes'),
        fetch('/api/admin/eleves'),
        fetch('/api/admin/librairie/commandes')
      ]);
      if (resArticles.ok) setArticles(await resArticles.json());
      if (resVentes.ok) setVentes(await resVentes.json());
      if (resEleves.ok) setEleves(await resEleves.json());
      if (resCmd.ok) {
        const cmdData = await resCmd.json();
        const enAttente = Array.isArray(cmdData) ? cmdData.filter((c: any) => c.statut === "en_attente").length : 0;
        setCommandesCount({ total: Array.isArray(cmdData) ? cmdData.length : 0, enAttente });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fonction pour formater un nombre en GNF
  const formatPrix = (valeur: number) => {
    return new Intl.NumberFormat('fr-FR').format(valeur);
  };

  // Gérer le changement du prix
  const handlePrixChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const digitsOnly = rawValue.replace(/[^\d]/g, '');
    const numericValue = parseInt(digitsOnly) || 0;

    setPrixFormate(formatPrix(numericValue));
    setArticleData({
      ...articleData,
      prix_unitaire: numericValue
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/admin/librairie/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        return data.url;
      }
    } catch (err) {
      console.error("Erreur upload:", err);
    }
    return null;
  };

  // ⭐ Soumission article avec anti-double soumission
  const handleArticleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingArticle) return;

    setIsSubmittingArticle(true);
    setUploading(true);
    try {
      let imageUrl = articleData.image_url;

      if (selectedFile) {
        const uploadedUrl = await uploadImage(selectedFile);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      const method = editingArticle ? 'PUT' : 'POST';
      const body = {
        ...articleData,
        id: editingArticle?.id,
        image_url: imageUrl
      };
      const res = await fetch('/api/admin/librairie/articles', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setShowArticleForm(false);
        setEditingArticle(null);
        setSelectedFile(null);
        setPreviewUrl("");
        setPrixFormate("");
        fetchData();
      } else {
        const error = await res.json();
        alert(error.error || "Erreur lors de l'enregistrement");
      }
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'enregistrement");
    } finally {
      setUploading(false);
      setIsSubmittingArticle(false);
    }
  };

  const openEditForm = (article: Article) => {
    setEditingArticle(article);
    setArticleData(article);
    setPrixFormate(formatPrix(article.prix_unitaire));
    setSelectedFile(null);
    setPreviewUrl("");
    setShowArticleForm(true);
  };

  // ⭐ Ouvre le modal de confirmation pour supprimer un article
  const handleDeleteArticle = (article: Article) => {
    if (deletingArticleId !== null) return;
    setArticleToDelete(article);
  };

  // ⭐ Confirme et exécute la suppression de l'article
  const confirmDeleteArticle = async () => {
    if (!articleToDelete || deletingArticleId !== null) return;

    const id = articleToDelete.id;
    setDeletingArticleId(id);
    try {
      const res = await fetch(`/api/admin/librairie/articles?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setArticleToDelete(null);
        fetchData();
      } else {
        const error = await res.json();
        alert(error.error || "Erreur lors de la suppression");
      }
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la suppression");
    } finally {
      setDeletingArticleId(null);
    }
  };

  // ⭐ Soumission vente avec anti-double soumission
  const handleVenteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingVente) return;

    setIsSubmittingVente(true);
    try {
      const res = await fetch('/api/admin/librairie/ventes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(venteData)
      });
      if (res.ok) {
        setShowVenteForm(false);
        setVenteData({ article_id: "", eleve_id: "", quantite: 1 });
        fetchData();
      } else {
        const error = await res.json();
        alert(error.error || "Erreur de vente");
      }
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la vente");
    } finally {
      setIsSubmittingVente(false);
    }
  };

  // ⭐⭐ NOUVELLE FONCTION : Ouvre le modal de confirmation pour supprimer une vente
  const handleDeleteVente = (vente: Vente) => {
    if (deletingVenteId !== null) return;
    setVenteToDelete(vente);
  };

  // ⭐⭐ NOUVELLE FONCTION : Confirme et exécute la suppression de la vente
  const confirmDeleteVente = async () => {
    if (!venteToDelete || deletingVenteId !== null) return;

    const id = venteToDelete.id;
    setDeletingVenteId(id);
    try {
      const res = await fetch(`/api/admin/librairie/ventes?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setVenteToDelete(null);
        fetchData();
      } else {
        const error = await res.json();
        alert(error.error || "Erreur lors de la suppression");
      }
    } catch (e) {
      console.error("Erreur suppression vente:", e);
      alert("Erreur lors de la suppression de la vente");
    } finally {
      setDeletingVenteId(null);
    }
  };

  const filteredArticles = articles.filter(a => a.nom.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredVentes = ventes.filter(v => v.article_nom.toLowerCase().includes(searchTerm.toLowerCase()) || (v.eleve_nom && v.eleve_nom.toLowerCase().includes(searchTerm.toLowerCase())));

  // ⭐ Statistiques avec "Articles vendus"
  const stats = {
    totalArticles: articles.length,
    valeurStock: articles.reduce((acc, a) => acc + (a.prix_unitaire * a.quantite_stock), 0),
    nombreVentes: ventes.length,
    recettesVentes: ventes.reduce((acc, v) => acc + Number(v.montant_total), 0),
    totalQuantiteVendue: ventes.reduce((acc, v) => acc + v.quantite, 0),
  };

  if (loading) return <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-black">Librairie de l'école</h1>
          <p className="text-gray-900">Gestion des fournitures, uniformes et ventes</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500 flex items-center justify-between">
          <div><p className="text-sm text-gray-900">Articles en stock</p><p className="text-2xl font-bold text-gray-900">{stats.totalArticles}</p></div>
          <Box className="text-blue-200 w-10 h-10" />
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-purple-500 flex items-center justify-between">
          <div><p className="text-sm text-gray-900">Valeur du stock</p><p className="text-2xl font-bold text-purple-600">{stats.valeurStock.toLocaleString()} GNF</p></div>
          <Store className="text-purple-200 w-10 h-10" />
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500 flex items-center justify-between">
          <div><p className="text-sm text-gray-900">Nombre de ventes</p><p className="text-2xl font-bold text-green-600">{stats.nombreVentes}</p></div>
          <ShoppingCart className="text-green-200 w-10 h-10" />
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-orange-500 flex items-center justify-between">
          <div><p className="text-sm text-gray-900">Recettes</p><p className="text-2xl font-bold text-orange-600">{stats.recettesVentes.toLocaleString()} GNF</p></div>
          <CreditCard className="text-orange-200 w-10 h-10" />
        </div>
        <Link href="/dashboard/admin/librairie/commandes" className="block">
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-yellow-500 flex items-center justify-between hover:bg-yellow-50/40 transition">
            <div>
              <p className="text-sm text-gray-900">Commandes en attente</p>
              <p className="text-2xl font-bold text-yellow-600">{commandesCount.enAttente}</p>
            </div>
            <ShoppingCart className="text-yellow-400 w-10 h-10" />
          </div>
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="flex border-b flex-wrap items-center justify-between px-2">
          <div className="flex">
            <button onClick={() => setActiveTab("articles")} className={`px-6 py-4 font-medium transition-colors ${activeTab === "articles" ? "border-b-2 border-blue-600 text-blue-600 bg-blue-50/50" : "text-gray-900 hover:bg-gray-50"}`}>
              <Package className="w-4 h-4 inline mr-2" />
              Inventaire
            </button>
            <button onClick={() => setActiveTab("ventes")} className={`px-6 py-4 font-medium transition-colors ${activeTab === "ventes" ? "border-b-2 border-blue-600 text-blue-600 bg-blue-50/50" : "text-gray-900 hover:bg-gray-50"}`}>
              <ShoppingCart className="w-4 h-4 inline mr-2" />
              Historique des ventes
            </button>
          </div>

          <Link href="/dashboard/admin/librairie/commandes" className="my-2 mr-2">
            <button className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center gap-2 text-sm shadow-sm">
              <ShoppingCart className="w-4 h-4" />
              Gérer les commandes parents
              {commandesCount.enAttente > 0 && (
                <span className="bg-yellow-400 text-black text-xs font-extrabold px-2 py-0.5 rounded-full ml-1 animate-pulse">
                  {commandesCount.enAttente}
                </span>
              )}
            </button>
          </Link>
        </div>

        <div className="p-4 border-b flex flex-wrap justify-between gap-2 bg-gray-50/50">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-900 w-4 h-4" />
            <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm text-gray-900" />
          </div>
          {activeTab === "articles" ? (
            <button onClick={() => {
              setEditingArticle(null);
              setArticleData({ nom: "", description: "", prix_unitaire: 0, quantite_stock: 0, categorie: "fourniture", image_url: "" });
              setPrixFormate("");
              setSelectedFile(null);
              setPreviewUrl("");
              setShowArticleForm(true);
            }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700 whitespace-nowrap">
              <Plus className="w-4 h-4" /> Ajouter un article
            </button>
          ) : (
            <button onClick={() => setShowVenteForm(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-green-700 whitespace-nowrap">
              <ShoppingCart className="w-4 h-4" /> Nouvelle vente
            </button>
          )}
        </div>

        {/* Contenu - Articles */}
        {activeTab === "articles" && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-black">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Article</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Catégorie</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Prix Unitaire</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase">En Stock</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredArticles.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {a.image_url ? (
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            <img src={a.image_url} alt={a.nom} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Box className="w-6 h-6 text-gray-900" />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-gray-900">{a.nom}</p>
                          <p className="text-sm text-gray-900">{a.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-gray-100 text-gray-900 px-2 py-1 rounded-full text-xs capitalize">{a.categorie}</span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">{formatPrix(a.prix_unitaire)} GNF</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${a.quantite_stock > 10 ? "bg-green-100 text-green-700" : a.quantite_stock > 0 ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"}`}>
                        {a.quantite_stock}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditForm(a)}
                          disabled={deletingArticleId === a.id}
                          className="text-blue-600 hover:text-blue-800 p-1 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteArticle(a)}
                          disabled={deletingArticleId === a.id}
                          className="text-red-600 hover:text-red-800 p-1 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingArticleId === a.id ? (
                            <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredArticles.length === 0 && (
              <div className="text-center py-8 text-gray-900">
                <Package className="w-12 h-12 mx-auto mb-3 text-gray-900" />
                <p className="font-medium">Aucun article trouvé</p>
              </div>
            )}
          </div>
        )}

        {/* Contenu - Ventes */}
        {activeTab === "ventes" && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-black">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Article</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Élève</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase">Quantité</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Montant Total</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Vendeur</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredVentes.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm text-gray-900">{new Date(v.date_vente).toLocaleDateString()}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{v.article_nom}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{v.eleve_nom || "Vente libre"}</td>
                    <td className="px-6 py-4 text-center font-semibold">{v.quantite}</td>
                    <td className="px-6 py-4 text-right font-bold text-green-600">{formatPrix(v.montant_total)} GNF</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{v.vendeur}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => handleDeleteVente(v)}
                          disabled={deletingVenteId === v.id}
                          className="text-red-600 hover:text-red-800 p-1 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Supprimer cette vente (le stock sera restauré)"
                        >
                          {deletingVenteId === v.id ? (
                            <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredVentes.length === 0 && (
              <div className="text-center py-8 text-gray-900">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-900" />
                <p className="font-medium">Aucune vente trouvée</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Formulaire Article */}
      {showArticleForm && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">{editingArticle ? "Modifier l'article" : "Nouvel article"}</h2>
              <button
                onClick={() => setShowArticleForm(false)}
                disabled={isSubmittingArticle}
                className="text-gray-900 hover:text-gray-900 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleArticleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Image de l'article</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-500 transition relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    disabled={uploading || isSubmittingArticle}
                  />
                  {previewUrl || articleData.image_url ? (
                    <div className="relative inline-block">
                      <img src={previewUrl || articleData.image_url || ""} alt="Aperçu" className="w-32 h-32 object-cover rounded-lg mx-auto" />
                      <button type="button" onClick={handleRemoveImage} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="w-10 h-10 text-gray-900 mx-auto mb-2" />
                      <p className="text-sm text-gray-900">Cliquez pour ajouter une image</p>
                      <p className="text-xs text-gray-900">PNG, JPG, WEBP</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Nom de l'article *</label>
                <input required type="text" value={articleData.nom || ""} onChange={e => setArticleData({ ...articleData, nom: e.target.value })} disabled={isSubmittingArticle} className="w-full border border-gray-300 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Description</label>
                <textarea rows={2} value={articleData.description || ""} onChange={e => setArticleData({ ...articleData, description: e.target.value })} disabled={isSubmittingArticle} className="w-full border border-gray-300 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Prix Unitaire (GNF) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-900 text-sm">GNF</span>
                    <input required type="text" inputMode="numeric" value={prixFormate || (articleData.prix_unitaire ? formatPrix(articleData.prix_unitaire) : "")} onChange={handlePrixChange} placeholder="0" disabled={isSubmittingArticle} className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
                  </div>
                  <p className="text-xs text-gray-900 mt-1">Saisissez uniquement des chiffres</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Quantité en stock *</label>
                  <input required type="number" min="0" placeholder="0" value={articleData.quantite_stock === 0 && !editingArticle ? "" : articleData.quantite_stock ?? 0} onChange={e => {
                    const value = e.target.value;
                    if (value === "") setArticleData({ ...articleData, quantite_stock: 0 });
                    else { const val = parseInt(value); if (!isNaN(val) && val >= 0) setArticleData({ ...articleData, quantite_stock: val }); }
                  }} disabled={isSubmittingArticle} className="w-full border border-gray-300 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Catégorie</label>
                <select value={articleData.categorie || "fourniture"} onChange={e => setArticleData({ ...articleData, categorie: e.target.value })} disabled={isSubmittingArticle} className="w-full border border-gray-300 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100">
                  <option value="fourniture">Fourniture scolaire</option>
                  <option value="uniforme">Uniforme / Tenue</option>
                  <option value="livre">Livre / Cahier</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowArticleForm(false)} disabled={isSubmittingArticle} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed">Annuler</button>
                <button type="submit" disabled={uploading || isSubmittingArticle} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 hover:bg-blue-700 transition">
                  {(uploading || isSubmittingArticle) && <Loader2 className="w-4 h-4 animate-spin" />}
                  {(uploading || isSubmittingArticle) ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Formulaire Vente */}
      {showVenteForm && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Nouvelle vente</h2>
              <button onClick={() => setShowVenteForm(false)} disabled={isSubmittingVente} className="text-gray-900 hover:text-gray-900 disabled:opacity-50">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleVenteSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Article *</label>
                <select required value={venteData.article_id} onChange={e => setVenteData({ ...venteData, article_id: e.target.value })} disabled={isSubmittingVente} className="w-full border border-gray-300 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100">
                  <option value="">Sélectionner un article</option>
                  {articles.filter(a => a.quantite_stock > 0).map(a => (
                    <option key={a.id} value={a.id}>{a.nom} - {formatPrix(a.prix_unitaire)} GNF (Stock: {a.quantite_stock})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Élève (Optionnel)</label>
                <select value={venteData.eleve_id} onChange={e => setVenteData({ ...venteData, eleve_id: e.target.value })} disabled={isSubmittingVente} className="w-full border border-gray-300 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100">
                  <option value="">Vente libre / Anonyme</option>
                  {eleves.map(e => (
                    <option key={e.id} value={e.id}>{e.prenom} {e.nom} ({e.matricule})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Quantité *</label>
                <input required type="number" min="1" value={venteData.quantite || 1} onChange={e => {
                  const val = parseInt(e.target.value);
                  setVenteData({ ...venteData, quantite: isNaN(val) || val < 1 ? 1 : val });
                }} disabled={isSubmittingVente} className="w-full border border-gray-300 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowVenteForm(false)} disabled={isSubmittingVente} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed">Annuler</button>
                <button type="submit" disabled={isSubmittingVente} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {isSubmittingVente ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Validation...
                    </>
                  ) : (
                    "Valider la vente"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ⭐⭐ MODAL DE CONFIRMATION - Suppression d'une VENTE ⭐⭐ */}
      {venteToDelete && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[60] p-4 animate-fade-in">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md border border-gray-100">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  Supprimer cette vente ?
                </h3>
                <p className="text-sm text-gray-900">
                  Voulez-vous vraiment supprimer cette vente ? Le stock sera automatiquement restauré.
                </p>
              </div>
            </div>

            {/* Récapitulatif de la vente à supprimer */}
            <div className="bg-gray-50 rounded-lg p-4 mb-5 border border-gray-200">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-900 text-xs uppercase font-semibold">Article</p>
                  <p className="font-bold text-gray-900">{venteToDelete.article_nom}</p>
                </div>
                <div>
                  <p className="text-gray-900 text-xs uppercase font-semibold">Quantité</p>
                  <p className="font-bold text-gray-900">{venteToDelete.quantite}</p>
                </div>
                <div>
                  <p className="text-gray-900 text-xs uppercase font-semibold">Élève</p>
                  <p className="font-bold text-gray-900">{venteToDelete.eleve_nom || "Vente libre"}</p>
                </div>
                <div>
                  <p className="text-gray-900 text-xs uppercase font-semibold">Montant</p>
                  <p className="font-bold text-green-600">{formatPrix(venteToDelete.montant_total)} GNF</p>
                </div>
              </div>
            </div>

            {/* Boutons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setVenteToDelete(null)}
                disabled={deletingVenteId !== null}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDeleteVente}
                disabled={deletingVenteId !== null}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deletingVenteId !== null ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Suppression...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Supprimer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⭐⭐ MODAL DE CONFIRMATION - Suppression d'un ARTICLE ⭐⭐ */}
      {articleToDelete && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[60] p-4 animate-fade-in">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md border border-gray-100">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  Supprimer cet article ?
                </h3>
                <p className="text-sm text-gray-900">
                  Voulez-vous vraiment supprimer cet article de la librairie ? Cette action est irréversible.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-5 border border-gray-200">
              <div className="flex items-center gap-3">
                {articleToDelete.image_url ? (
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    <img src={articleToDelete.image_url} alt={articleToDelete.nom} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Box className="w-6 h-6 text-gray-900" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 truncate">{articleToDelete.nom}</p>
                  <p className="text-sm text-gray-900">
                    Stock : {articleToDelete.quantite_stock} • {formatPrix(articleToDelete.prix_unitaire)} GNF
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setArticleToDelete(null)}
                disabled={deletingArticleId !== null}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDeleteArticle}
                disabled={deletingArticleId !== null}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deletingArticleId !== null ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Suppression...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Supprimer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
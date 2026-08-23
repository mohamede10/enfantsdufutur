import re

with open('app/reinscription/ReinscriptionForm.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Imports
c = c.replace('import { useState, useEffect } from "react";\nimport { useRouter, useSearchParams } from "next/navigation";\nimport { useSession } from "next-auth/react";\nimport {\n  User, Mail, Lock, Phone, Calendar, MapPin, Upload, CheckCircle,\n  ArrowRight, ArrowLeft, GraduationCap, Plus, Trash2, Users, Eye, EyeOff,\n  Loader2, Heart, ShoppingCart, Bus, Utensils, X, Minus\n} from "lucide-react";', 
'import { useState, useEffect } from "react";\nimport { useRouter, useSearchParams } from "next/navigation";\nimport { useSession } from "next-auth/react";\nimport {\n  User, Mail, Lock, Phone, Calendar, MapPin, Upload, CheckCircle,\n  ArrowRight, ArrowLeft, GraduationCap, Plus, Trash2, Users, Eye, EyeOff,\n  Loader2, Heart, ShoppingCart, Bus, Utensils, X, Minus, RefreshCw, Search, AlertTriangle\n} from "lucide-react";')

# 2. Interfaces
c = c.replace('  bulletin: File | null;\n}', '  bulletin: File | null;\n  ancienneClasse: string;\n  ancienNiveau: string;\n}')
c = c.replace('interface Classe {\n  id: number;\n  nom: string;\n  niveau: string;\n}', 'interface Classe {\n  id: number;\n  nom: string;\n  niveau: string;\n  frais_inscription: number;\n  total_versement: number;\n  reinscription_total_versement: number;\n  reinscription_premier_versement: number;\n  reinscription_deuxieme_versement: number;\n  reinscription_troisieme_versement: number;\n}')

# 3. Component Name and States
c = c.replace('export default function RegisterForm()', 'export default function ReinscriptionForm()')
c = c.replace('const [totalInscription, setTotalInscription] = useState(0);', 'const [totalReinscription, setTotalReinscription] = useState(0);\n  const [searchMatricule, setSearchMatricule] = useState("");\n  const [foundEleve, setFoundEleve] = useState<any>(null);\n  const [searchingEleve, setSearchingEleve] = useState(false);\n  const [eleveNotFound, setEleveNotFound] = useState(false);')

# 4. Enfant initial state
c = c.replace('      bulletin: null,\n    }', '      bulletin: null,\n      ancienneClasse: "",\n      ancienNiveau: "",\n    }')

# 5. totalReinscription effect
c = c.replace('        if (matchedClass && (matchedClass as any).frais_inscription) {\n          total += (matchedClass as any).frais_inscription;\n        }', '        if (matchedClass) {\n          const montant = matchedClass.reinscription_total_versement || matchedClass.total_versement || matchedClass.frais_inscription || 0;\n          total += montant;\n        }')
c = c.replace('setTotalInscription(total);', 'setTotalReinscription(total);')

# 6. type: "reinscription"
c = c.replace('        enfants: enfantsAvecUrls,\n      };', '        enfants: enfantsAvecUrls,\n        type: "reinscription",\n      };')
c = c.replace('      requestBody.montant_inscription = totalInscription;', '      requestBody.montant_inscription = totalReinscription;')

# 7. Session storage and redirect
c = c.replace('sessionStorage.setItem("preinscription"', 'sessionStorage.setItem("reinscription"')
c = c.replace('router.push("/register-success");', 'router.push("/reinscription-success");')

# 8. Text replacement (Inscription -> Réinscription)
c = c.replace('Inscription scolaire', 'Réinscription scolaire')
c = c.replace('Inscrivez vos enfants pour la prochaine année scolaire', 'Réinscrivez vos enfants pour la prochaine année scolaire')

# 9. add searchEleve function
search_func = '''
  const searchEleve = async () => {
    if (!searchMatricule.trim()) return;
    setSearchingEleve(true);
    setEleveNotFound(false);
    setFoundEleve(null);
    try {
      const response = await fetch(`/api/public/eleves/search?matricule=${encodeURIComponent(searchMatricule.trim())}`);
      const data = await response.json();
      if (data.found) {
        setFoundEleve(data.eleve);
        const enfant = enfants[activeEnfantIndex];
        enfant.nom = data.eleve.nom;
        enfant.prenom = data.eleve.prenom;
        enfant.dateNaissance = data.eleve.date_naissance;
        enfant.lieuNaissance = data.eleve.lieu_naissance || "";
        enfant.sexe = data.eleve.sexe || "";
        enfant.ancienneClasse = data.eleve.classe_nom || "";
        enfant.ancienNiveau = data.eleve.niveau || "";
        
        // Suggest next level if they already have one
        if (data.eleve.niveau) {
           const niveaux = [...new Set(classes.map(c => c.niveau))];
           const indexActuel = niveaux.indexOf(data.eleve.niveau);
           if (indexActuel < niveaux.length - 1 && indexActuel !== -1) {
             enfant.niveau = niveaux[indexActuel + 1];
           } else {
             enfant.niveau = data.eleve.niveau;
           }
        }
        
        setEnfants([...enfants]);
      } else {
        setEleveNotFound(true);
      }
    } catch (error) {
      console.error("Erreur recherche élève:", error);
      setEleveNotFound(true);
    } finally {
      setSearchingEleve(false);
    }
  };
'''
c = c.replace('  const addEnfant = () => {', search_func + '\n  const addEnfant = () => {')

with open('app/reinscription/ReinscriptionForm.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

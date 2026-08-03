"use client";

import { useState, useEffect } from "react";
import { Users, GraduationCap, FileText, BarChart3, Loader2 } from "lucide-react";

export default function DirecteurEtudesDashboard() {
  const [statsData, setStatsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/directeur_etudes/stats")
      .then(res => res.json())
      .then(data => {
        setStatsData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const stats = [
    { title: "Classes actives", value: statsData?.classesActives || "0", icon: GraduationCap, color: "bg-blue-100 text-blue-600" },
    { title: "Notes saisies", value: statsData?.notesSaisies || "0", icon: FileText, color: "bg-green-100 text-green-600" },
    { title: "Élèves", value: statsData?.elevesInscrits || "0", icon: Users, color: "bg-orange-100 text-orange-600" },
    { title: "Élèves Évalués", value: statsData?.elevesEvalues || "0", icon: BarChart3, color: "bg-purple-100 text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de Bord - Direction des Études</h1>
          <p className="text-gray-500 mt-1">Gérez les notes et les bulletins scolaires</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className={`p-4 rounded-xl ${stat.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

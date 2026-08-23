// app/reinscription/page.tsx
import { Suspense } from "react";
import ReinscriptionForm from "./ReinscriptionForm";

export const metadata = {
  title: "Réinscription scolaire - EIEF",
  description: "Réinscrivez vos enfants pour l'année scolaire",
};

export default function ReinscriptionPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <Suspense fallback={<div className="flex justify-center py-20"><div className="w-8 h-8 animate-spin text-blue-600 rounded-full border-4 border-blue-600 border-t-transparent"></div></div>}>
          <ReinscriptionForm />
        </Suspense>
      </div>
    </div>
  );
}

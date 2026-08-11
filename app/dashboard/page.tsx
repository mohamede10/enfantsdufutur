import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/login");
  }

  const role = (session.user as any)?.role;

  const roleRedirectMap: Record<string, string> = {
    "SUPER_ADMIN": "/dashboard/admin",
    "ADMIN": "/dashboard/admin",
    "DIRECTEUR_GENERAL": "/dashboard/directeur",
    "DIRECTEUR_ETUDES": "/dashboard/directeur_etudes",
    "COMPTABLE": "/dashboard/admin",
    "SECRETARIAT": "/dashboard/admin",
    "SURVEILLANT": "/dashboard/admin",
    "ENSEIGNANT": "/dashboard/enseignant",
    "PARENT": "/dashboard/parent",
    "ELEVE": "/dashboard/eleve",
    "ADMIN_CANTINE": "/dashboard/admin_cantine",
    "ADMIN_TRANSPORT": "/dashboard/admin_transport",
    "ADMIN_BIBLIOTHEQUE": "/dashboard/admin_bibliotheque",
    "ADMIN_LIBRAIRIE": "/dashboard/admin_librairie",
    "CHAUFFEUR": "/dashboard/admin_transport",
    "CANTINE": "/dashboard/admin_cantine",
  };

  const redirectPath = roleRedirectMap[role];

  if (redirectPath) {
    redirect(redirectPath);
  }

  redirect("/login");
}
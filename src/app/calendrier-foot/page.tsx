import { redirect } from "next/navigation";

// Redirige /calendrier-foot → dashboard onglet football (FotMob style)
export default function CalendrierFootPage() {
  redirect("/?sport=football");
}

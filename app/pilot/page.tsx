import { permanentRedirect } from "next/navigation";
export default function LegacyPlanPage() {
  permanentRedirect("/pricing");
}

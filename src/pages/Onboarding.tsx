import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import ProfileForm from "../components/ProfileForm";

export default function Onboarding() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  if (!profile) return null;
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">¡Bienvenido! 👋</h1>
      <p className="mb-6 mt-1 text-slate-400">Cuéntanos un poco de ti para que el coach arme rutinas a tu medida. Toma 1 minuto.</p>
      <ProfileForm profile={profile} submitLabel="Empezar" onSaved={async () => { await refreshProfile(); navigate("/"); }} />
    </div>
  );
}

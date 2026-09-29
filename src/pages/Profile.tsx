import { useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "../lib/auth";
import ProfileForm from "../components/ProfileForm";
import { Button, Card, PageHeader } from "../components/ui";

export default function ProfilePage() {
  const { profile, session, refreshProfile, signOut } = useAuth();
  const [saved, setSaved] = useState(false);
  if (!profile) return null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Perfil"
        action={<Button variant="secondary" onClick={signOut}><LogOut className="h-4 w-4" /> Salir</Button>}
      />
      <Card className="flex items-center gap-3">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="h-12 w-12 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/20 text-lg font-bold text-brand">{(profile.full_name ?? "?")[0]}</div>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold">{profile.full_name ?? "Sin nombre"}</p>
          <p className="truncate text-sm text-slate-400">{session?.user.email}</p>
        </div>
      </Card>

      {saved && <p className="rounded-xl bg-brand/10 px-3 py-2 text-sm text-brand">Cambios guardados. El coach los usará en tus próximas rutinas.</p>}

      <ProfileForm
        profile={profile}
        submitLabel="Guardar cambios"
        onSaved={async () => { await refreshProfile(); setSaved(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
      />

      <p className="text-center text-xs text-slate-500">
        Gym Tutor ofrece orientación general de entrenamiento y no reemplaza la evaluación de un profesional de la salud.
        Si sientes dolor, mareo o molestias, detente y consulta a un especialista.
      </p>
    </div>
  );
}

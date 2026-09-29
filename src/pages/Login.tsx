import { useState } from "react";
import { CalendarCheck, MessageCircle, Sparkles } from "lucide-react";
import { useAuth } from "../lib/auth";
import { ErrorNote } from "../components/ui";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

const features = [
  { icon: MessageCircle, title: "Pregúntale al coach", text: "Dile cómo te sientes y cuánto tiempo tienes: te arma una rutina de 4-5 ejercicios." },
  { icon: Sparkles, title: "Aprende la técnica", text: "Cada ejercicio con imágenes de ejecución, claves y video de referencia." },
  { icon: CalendarCheck, title: "Crea el hábito", text: "Registra tu asistencia, mira tus rachas y recibe insights semanales." },
];

export default function Login() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLogin() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(163,230,53,0.15),_transparent_60%)] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/favicon.svg" alt="" className="mx-auto mb-4 h-16 w-16" />
          <h1 className="text-3xl font-extrabold tracking-tight">Gym Tutor</h1>
          <p className="mt-2 text-slate-400">Tu coach de gimnasio para empezar con confianza.</p>
        </div>

        <div className="mb-8 space-y-3">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-slate-400">{text}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onLogin}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-60"
        >
          <GoogleIcon />
          {loading ? "Conectando..." : "Continuar con Google"}
        </button>
        <div className="mt-3"><ErrorNote message={error} /></div>
        <p className="mt-6 text-center text-xs text-slate-500">
          Gym Tutor da orientación general y no reemplaza a un profesional de la salud o entrenador certificado.
        </p>
      </div>
    </div>
  );
}

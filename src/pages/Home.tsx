import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CalendarCheck, Flame, MessageCircle, Play, Trophy } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { addDays, greeting, localDate, weekStart, weeklyStreak, WEEKDAYS_SHORT } from "../lib/dates";
import { startSession } from "../lib/data";
import type { Routine, WorkoutSession } from "../lib/types";
import { Button, Card, ErrorNote, Spinner } from "../components/ui";

const PROMPTS = [
  "Tengo 45 minutos, ¿qué hago hoy?",
  "Quiero trabajar piernas y glúteos",
  "Rutina de tren superior para principiantes",
  "Estoy cansado, algo suave",
];

export default function Home() {
  const { profile, session } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<WorkoutSession[] | null>(null);
  const [lastRoutine, setLastRoutine] = useState<Routine | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const since = localDate(addDays(new Date(), -120));
    Promise.all([
      supabase.from("workout_sessions").select("*").gte("session_date", since).order("started_at", { ascending: false }),
      supabase.from("routines").select("id, title, focus, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]).then(([s, r]) => {
      setSessions((s.data ?? []) as WorkoutSession[]);
      setLastRoutine(r.data as Routine | null);
    });
  }, []);

  if (!profile || !sessions) return <Spinner />;

  const today = localDate();
  const dates = sessions.map((s) => s.session_date);
  const dateSet = new Set(dates);
  const monday = weekStart();
  const week = Array.from({ length: 7 }, (_, i) => localDate(addDays(monday, i)));
  const doneThisWeek = week.filter((d) => dateSet.has(d)).length;
  const goal = profile.days_per_week;
  const streak = weeklyStreak(dates, goal);
  const openSession = sessions.find((s) => s.session_date === today && !s.ended_at);
  const trainedToday = dateSet.has(today);
  const pct = Math.min(100, Math.round((doneThisWeek / goal) * 100));
  const firstName = profile.full_name?.split(" ")[0] ?? "";

  async function checkIn(routineId: string | null) {
    setBusy(true);
    setError(null);
    try {
      const s = await startSession(session!.user.id, routineId);
      navigate(`/entreno/${s.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-slate-400">{greeting()}{firstName && `, ${firstName}`}</p>
        <h1 className="text-2xl font-bold tracking-tight">
          {trainedToday ? "¡Hoy ya sumaste! 🎉" : doneThisWeek >= goal ? "Meta semanal cumplida 🏆" : "¿Entrenamos hoy?"}
        </h1>
      </div>

      {/* Semana */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">Esta semana</p>
            <p className="text-2xl font-bold">{doneThisWeek}<span className="text-base font-medium text-slate-500"> / {goal} días</span></p>
          </div>
          <div className="flex gap-3 text-right">
            <div>
              <p className="flex items-center justify-end gap-1 text-2xl font-bold text-orange-400"><Flame className="h-5 w-5" />{streak}</p>
              <p className="text-xs text-slate-500">semanas en racha</p>
            </div>
          </div>
        </div>
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {week.map((d, i) => {
            const done = dateSet.has(d);
            const isToday = d === today;
            return (
              <div key={d} className="flex flex-col items-center gap-1">
                <span className={`text-xs ${isToday ? "text-brand" : "text-slate-500"}`}>{WEEKDAYS_SHORT[i]}</span>
                <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${
                  done ? "bg-brand font-bold text-slate-950" : isToday ? "border-2 border-brand/60 text-slate-300" : "bg-slate-800 text-slate-500"
                }`}>
                  {done ? "✓" : Number(d.slice(8))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <ErrorNote message={error} />

      {openSession ? (
        <Card className="border-brand/40 bg-brand/5">
          <p className="font-semibold">Tienes un entrenamiento en curso</p>
          <p className="mb-3 text-sm text-slate-400">Continúa registrando tus series y termina la sesión.</p>
          <Button onClick={() => navigate(`/entreno/${openSession.id}`)}><Play className="h-4 w-4" /> Continuar</Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/coach" className="group rounded-2xl bg-brand p-4 text-slate-950 transition hover:bg-lime-300">
            <MessageCircle className="mb-3 h-6 w-6" />
            <p className="font-bold">Pedir rutina al coach</p>
            <p className="text-sm opacity-80">4-5 ejercicios según tu objetivo y tu día</p>
          </Link>
          <button
            onClick={() => checkIn(null)}
            disabled={busy}
            className="rounded-2xl border border-slate-700 bg-slate-900 p-4 text-left transition hover:border-slate-500 disabled:opacity-50"
          >
            <CalendarCheck className="mb-3 h-6 w-6 text-brand" />
            <p className="font-bold">Marcar asistencia</p>
            <p className="text-sm text-slate-400">Entrenamiento libre, sin rutina</p>
          </button>
        </div>
      )}

      {lastRoutine && !openSession && (
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-500">Tu última rutina</p>
          <p className="mt-1 font-semibold">{lastRoutine.title}</p>
          {lastRoutine.focus && <p className="text-sm text-slate-400">{lastRoutine.focus}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => checkIn(lastRoutine.id)} loading={busy}><Play className="h-4 w-4" /> Hacerla hoy</Button>
            <Button variant="secondary" onClick={() => navigate(`/rutina/${lastRoutine.id}`)}>Ver detalle</Button>
          </div>
        </Card>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-slate-400">Ideas para preguntarle al coach</p>
        <div className="space-y-2">
          {PROMPTS.map((p) => (
            <Link key={p} to={`/coach?q=${encodeURIComponent(p)}`} className="flex items-center justify-between rounded-xl border border-slate-800 px-4 py-3 text-sm hover:border-slate-600">
              {p} <ArrowRight className="h-4 w-4 text-slate-500" />
            </Link>
          ))}
        </div>
      </div>

      {streak >= 2 && (
        <Card className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-yellow-400" />
          <p className="text-sm">Llevas <b>{streak} semanas</b> cumpliendo tu meta. ¡La constancia es lo que da resultados!</p>
        </Card>
      )}
    </div>
  );
}

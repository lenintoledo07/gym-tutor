import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, ChevronLeft, Plus, Search, Timer, Trash2, X, Video } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchRoutine } from "../lib/data";
import type { Exercise, SetLog, WorkoutSession } from "../lib/types";
import { MOODS, youtubeUrl } from "../lib/labels";
import ExerciseMedia from "../components/ExerciseMedia";
import { Button, Card, ErrorNote, Spinner } from "../components/ui";

interface Item {
  exercise_id: string;
  display_name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  cues: string[];
  images: string[];
}
interface Entry { reps: string; weight: string; done: boolean }

const key = (ex: string, n: number) => `${ex}#${n}`;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function Workout() {
  const { sessionId } = useParams();
  const { session: auth } = useAuth();
  const navigate = useNavigate();
  const [ws, setWs] = useState<WorkoutSession | null>(null);
  const [title, setTitle] = useState("Entrenamiento libre");
  const [items, setItems] = useState<Item[]>([]);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [previous, setPrevious] = useState<Record<string, SetLog>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (restUntil && now >= restUntil) {
      setRestUntil(null);
      navigator.vibrate?.([200, 100, 200]);
    }
  }, [now, restUntil]);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("workout_sessions").select("*").eq("id", sessionId).maybeSingle();
      if (!s) { setLoading(false); return; }
      setWs(s as WorkoutSession);

      let list: Item[] = [];
      if (s.routine_id) {
        const r = await fetchRoutine(s.routine_id);
        if (r) {
          setTitle(r.title);
          list = (r.routine_exercises ?? []).map((re) => ({
            exercise_id: re.exercise_id, display_name: re.display_name, sets: re.sets, reps: re.reps,
            rest_seconds: re.rest_seconds, cues: re.cues, images: re.exercises?.images ?? [],
          }));
        }
      }

      const { data: logs } = await supabase.from("set_logs").select("*, exercises(name, images)").eq("session_id", sessionId);
      const e: Record<string, Entry> = {};
      for (const l of (logs ?? []) as (SetLog & { exercises: Pick<Exercise, "name" | "images"> })[]) {
        e[key(l.exercise_id, l.set_number)] = { reps: l.reps?.toString() ?? "", weight: l.weight_kg?.toString() ?? "", done: true };
        if (!list.some((i) => i.exercise_id === l.exercise_id)) {
          list.push({ exercise_id: l.exercise_id, display_name: l.exercises.name, sets: 3, reps: "10-12", rest_seconds: 60, cues: [], images: l.exercises.images });
        }
      }
      setEntries(e);
      setItems(list);
      await loadPrevious(list.map((i) => i.exercise_id));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function loadPrevious(ids: string[]) {
    if (!ids.length) return;
    const { data } = await supabase.from("set_logs").select("*")
      .in("exercise_id", ids).neq("session_id", sessionId!).order("created_at", { ascending: false }).limit(200);
    const prev: Record<string, SetLog> = {};
    for (const l of (data ?? []) as SetLog[]) {
      const cur = prev[l.exercise_id];
      // Nos quedamos con la serie más pesada de la sesión más reciente
      if (!cur) prev[l.exercise_id] = l;
      else if (cur.session_id === l.session_id && (l.weight_kg ?? 0) > (cur.weight_kg ?? 0)) prev[l.exercise_id] = l;
    }
    setPrevious((p) => ({ ...p, ...prev }));
  }

  const totalSets = items.reduce((a, i) => a + i.sets, 0);
  const doneSets = Object.values(entries).filter((e) => e.done).length;
  const elapsed = ws ? Math.max(0, Math.floor((now - new Date(ws.started_at).getTime()) / 1000)) : 0;

  function update(ex: string, n: number, patch: Partial<Entry>) {
    setEntries((e) => ({ ...e, [key(ex, n)]: { ...(e[key(ex, n)] ?? { reps: "", weight: "", done: false }), ...patch } }));
  }

  async function toggle(item: Item, n: number) {
    const k = key(item.exercise_id, n);
    const cur = entries[k] ?? { reps: "", weight: "", done: false };
    setError(null);
    if (cur.done) {
      update(item.exercise_id, n, { done: false });
      await supabase.from("set_logs").delete().match({ session_id: sessionId, exercise_id: item.exercise_id, set_number: n });
      return;
    }
    const targetReps = parseInt(item.reps, 10);
    const reps = cur.reps ? parseInt(cur.reps, 10) : Number.isFinite(targetReps) ? targetReps : null;
    const weight = cur.weight ? Number(cur.weight.replace(",", ".")) : null;
    update(item.exercise_id, n, { done: true, reps: reps?.toString() ?? "" });
    const { error } = await supabase.from("set_logs").upsert({
      session_id: sessionId, user_id: auth!.user.id, exercise_id: item.exercise_id, set_number: n, reps, weight_kg: weight,
    }, { onConflict: "session_id,exercise_id,set_number" });
    if (error) { setError(error.message); update(item.exercise_id, n, { done: false }); return; }
    setRestUntil(Date.now() + item.rest_seconds * 1000);
  }

  async function addExercise(ex: Exercise) {
    setPicker(false);
    if (items.some((i) => i.exercise_id === ex.id)) return;
    setItems((l) => [...l, { exercise_id: ex.id, display_name: ex.name, sets: 3, reps: "10-12", rest_seconds: 60, cues: [], images: ex.images }]);
    await loadPrevious([ex.id]);
  }

  async function discard() {
    if (!confirmDiscard()) return;
    await supabase.from("workout_sessions").delete().eq("id", sessionId);
    navigate("/", { replace: true });
  }
  function confirmDiscard() {
    return doneSets === 0 || window.confirm("¿Descartar este entrenamiento? Se borrarán las series registradas.");
  }

  if (loading) return <Spinner label="Preparando tu entrenamiento..." />;
  if (!ws) return <div className="p-6 text-slate-400">Sesión no encontrada.</div>;

  const restLeft = restUntil ? Math.max(0, Math.ceil((restUntil - now) / 1000)) : 0;

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-40 pt-4">
      <header className="sticky top-0 z-10 -mx-4 mb-4 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => navigate("/")} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800" aria-label="Salir"><ChevronLeft className="h-6 w-6" /></button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate font-semibold">{title}</p>
            <p className="text-xs text-slate-400">{fmt(elapsed)} · {doneSets}/{totalSets || "—"} series</p>
          </div>
          <button onClick={discard} className="rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-red-300" aria-label="Descartar"><Trash2 className="h-5 w-5" /></button>
        </div>
        {totalSets > 0 && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-brand transition-all" style={{ width: `${(doneSets / totalSets) * 100}%` }} />
          </div>
        )}
      </header>

      <ErrorNote message={error} />

      {ws.ended_at && (
        <Card className="mb-4 border-brand/40 text-sm">Este entrenamiento ya fue finalizado. Puedes corregir tus series si lo necesitas.</Card>
      )}

      {items.length === 0 && (
        <Card className="mb-4 text-center">
          <p className="font-semibold">¡Asistencia registrada! ✅</p>
          <p className="mt-1 text-sm text-slate-400">Agrega los ejercicios que hagas para llevar registro de tus cargas, o simplemente finaliza al terminar.</p>
        </Card>
      )}

      <div className="space-y-4">
        {items.map((item) => {
          const prev = previous[item.exercise_id];
          return (
            <Card key={item.exercise_id} className="p-3">
              <div className="flex gap-3">
                <ExerciseMedia images={item.images} alt={item.display_name} className="h-20 w-20 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">{item.display_name}</p>
                  <p className="text-sm text-slate-400">Objetivo: {item.sets} × {item.reps} · descanso {item.rest_seconds}s</p>
                  {prev && (
                    <p className="mt-0.5 text-xs text-brand">
                      La vez pasada: {prev.weight_kg != null ? `${prev.weight_kg} kg × ` : ""}{prev.reps ?? "?"} reps
                    </p>
                  )}
                  <a href={youtubeUrl(item.display_name)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-red-300">
                    <Video className="h-3.5 w-3.5" /> Ver técnica
                  </a>
                </div>
              </div>
              {item.cues.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
                  {item.cues.map((c, i) => <li key={i}>• {c}</li>)}
                </ul>
              )}

              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-[2rem_1fr_1fr_3rem] gap-2 px-1 text-xs text-slate-500">
                  <span>Serie</span><span>Kg</span><span>Reps</span><span />
                </div>
                {Array.from({ length: item.sets }, (_, i) => i + 1).map((n) => {
                  const e = entries[key(item.exercise_id, n)] ?? { reps: "", weight: "", done: false };
                  return (
                    <div key={n} className={`grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2 rounded-xl p-1 ${e.done ? "bg-brand/10" : ""}`}>
                      <span className="text-center text-sm font-semibold text-slate-400">{n}</span>
                      <input
                        inputMode="decimal"
                        placeholder={prev?.weight_kg?.toString() ?? "—"}
                        value={e.weight}
                        onChange={(ev) => update(item.exercise_id, n, { weight: ev.target.value })}
                        disabled={e.done}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-center text-sm outline-none focus:border-brand disabled:opacity-70"
                      />
                      <input
                        inputMode="numeric"
                        placeholder={item.reps}
                        value={e.reps}
                        onChange={(ev) => update(item.exercise_id, n, { reps: ev.target.value.replace(/\D/g, "") })}
                        disabled={e.done}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-center text-sm outline-none focus:border-brand disabled:opacity-70"
                      />
                      <button
                        onClick={() => toggle(item, n)}
                        className={`flex h-10 w-12 items-center justify-center rounded-lg transition ${e.done ? "bg-brand text-slate-950" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
                        aria-label={e.done ? "Desmarcar serie" : "Completar serie"}
                      >
                        <Check className="h-5 w-5" />
                      </button>
                    </div>
                  );
                })}
                <button
                  onClick={() => setItems((l) => l.map((x) => x.exercise_id === item.exercise_id ? { ...x, sets: Math.min(x.sets + 1, 10) } : x))}
                  className="w-full rounded-lg py-1.5 text-xs text-slate-500 hover:bg-slate-800"
                >
                  + Agregar serie
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <Button variant="secondary" className="mt-4 w-full" onClick={() => setPicker(true)}><Plus className="h-4 w-4" /> Agregar ejercicio</Button>

      {/* Barra inferior: descanso + finalizar */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-slate-800 bg-slate-950/95 px-4 pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          {restUntil ? (
            <div className="flex flex-1 items-center gap-3 rounded-xl bg-sky-500/15 px-3 py-2 text-sky-200">
              <Timer className="h-5 w-5" />
              <span className="text-sm">Descanso</span>
              <span className="ml-auto font-mono text-lg font-bold">{fmt(restLeft)}</span>
              <button onClick={() => setRestUntil((r) => (r ? r + 15000 : r))} className="rounded-md bg-sky-500/20 px-2 py-1 text-xs">+15s</button>
              <button onClick={() => setRestUntil(null)} className="rounded-md p-1" aria-label="Saltar descanso"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <p className="flex-1 text-sm text-slate-400">{doneSets === totalSets && totalSets > 0 ? "¡Todo listo! 💥" : "Marca cada serie al completarla"}</p>
          )}
          <Button onClick={() => setFinishing(true)}>Finalizar</Button>
        </div>
      </div>

      {finishing && <FinishModal session={ws} onClose={() => setFinishing(false)} onDone={() => navigate("/progreso", { replace: true })} />}
      {picker && <ExercisePicker onClose={() => setPicker(false)} onPick={addExercise} />}
    </div>
  );
}

function FinishModal({ session, onClose, onDone }: { session: WorkoutSession; onClose: () => void; onDone: () => void }) {
  const [effort, setEffort] = useState(session.effort ?? 6);
  const [mood, setMood] = useState(session.mood ?? "bien");
  const [notes, setNotes] = useState(session.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("workout_sessions").update({
      ended_at: session.ended_at ?? new Date().toISOString(), effort, mood, notes: notes.trim() || null,
    }).eq("id", session.id);
    setSaving(false);
    if (error) setError(error.message); else onDone();
  }

  const effortLabel = effort <= 3 ? "Muy suave" : effort <= 5 ? "Moderado" : effort <= 7 ? "Exigente" : effort <= 9 ? "Muy duro" : "Al límite";

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl border border-slate-800 bg-slate-900 p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold">¡Buen trabajo! 🎉</h2>
        <p className="mb-4 text-sm text-slate-400">Cuéntanos cómo estuvo para ajustar tus próximas rutinas.</p>

        <p className="mb-1 text-sm font-medium">Esfuerzo percibido: <span className="text-brand">{effort}/10 · {effortLabel}</span></p>
        <input type="range" min={1} max={10} value={effort} onChange={(e) => setEffort(Number(e.target.value))} className="mb-4 w-full accent-lime-400" />

        <p className="mb-2 text-sm font-medium">¿Cómo te sientes?</p>
        <div className="mb-4 flex gap-2">
          {MOODS.map((m) => (
            <button key={m.value} onClick={() => setMood(m.value)} className={`flex flex-1 flex-col items-center rounded-xl border py-2 text-xs capitalize ${mood === m.value ? "border-brand bg-brand/10" : "border-slate-700"}`}>
              <span className="text-2xl">{m.emoji}</span>{m.value}
            </button>
          ))}
        </div>

        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notas (opcional): molestias, qué te costó..." className="mb-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-brand" />
        <ErrorNote message={error} />
        <div className="mt-3 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Seguir entrenando</Button>
          <Button className="flex-1" onClick={save} loading={saving}>Guardar</Button>
        </div>
      </div>
    </div>
  );
}

function ExercisePicker({ onClose, onPick }: { onClose: () => void; onPick: (e: Exercise) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Exercise[]>([]);
  const term = useMemo(() => q.trim(), [q]);

  useEffect(() => {
    const t = setTimeout(async () => {
      let query = supabase.from("exercises").select("*").in("category", ["strength", "stretching", "cardio", "plyometrics"]).order("name").limit(25);
      if (term) query = query.ilike("name", `%${term}%`);
      else query = query.eq("level", "beginner");
      const { data } = await query;
      setResults((data ?? []) as Exercise[]);
    }, 250);
    return () => clearTimeout(t);
  }, [term]);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-3xl border border-slate-800 bg-slate-900 p-4 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3">
          <Search className="h-4 w-4 text-slate-500" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar (en inglés): squat, press, curl..." className="flex-1 bg-transparent py-2.5 text-sm outline-none" />
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {results.map((ex) => (
            <button key={ex.id} onClick={() => onPick(ex)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-slate-800">
              <ExerciseMedia images={ex.images.slice(0, 1)} alt={ex.name} className="h-12 w-12 shrink-0 rounded-lg" />
              <span className="text-sm">{ex.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

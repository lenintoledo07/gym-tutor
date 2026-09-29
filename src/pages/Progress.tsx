import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronLeft, ChevronRight, Lightbulb, RefreshCw, Sparkles, Trophy } from "lucide-react";
import { useAuth } from "../lib/auth";
import { callFunction, supabase } from "../lib/supabase";
import { addDays, localDate, MONTHS, parseLocal, weeklyStreak, WEEKDAYS_SHORT } from "../lib/dates";
import type { InsightContent, WorkoutSession } from "../lib/types";
import { MOODS } from "../lib/labels";
import { Button, Card, ErrorNote, PageHeader, Spinner } from "../components/ui";

interface Metric { measured_on: string; weight_kg: number }
type SessionRow = WorkoutSession & { routines: { title: string } | null };

export default function Progress() {
  const { profile, session } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [insight, setInsight] = useState<{ content: InsightContent; created_at: string } | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [weight, setWeight] = useState("");

  async function loadMetrics() {
    const { data } = await supabase.from("body_metrics").select("measured_on, weight_kg").order("measured_on").limit(60);
    setMetrics((data ?? []) as Metric[]);
  }

  useEffect(() => {
    supabase.from("workout_sessions").select("*, routines(title)").order("session_date", { ascending: false }).limit(500)
      .then(({ data }) => setSessions((data ?? []) as SessionRow[]));
    supabase.from("insights").select("content, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setInsight(data as typeof insight));
    loadMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateInsights() {
    setLoadingInsight(true);
    setInsightError(null);
    try {
      const res = await callFunction<{ insight: { content: InsightContent; created_at: string } }>("insights", {});
      setInsight(res.insight);
    } catch (e) {
      setInsightError((e as Error).message);
    } finally {
      setLoadingInsight(false);
    }
  }

  async function saveWeight() {
    const w = Number(weight.replace(",", "."));
    if (!w || w < 20 || w > 400) return;
    await supabase.from("body_metrics").upsert({ user_id: session!.user.id, measured_on: localDate(), weight_kg: w }, { onConflict: "user_id,measured_on" });
    setWeight("");
    loadMetrics();
  }

  if (!profile || !sessions) return <Spinner />;

  const dates = sessions.map((s) => s.session_date);
  const dateSet = new Set(dates);
  const uniqueDays = dateSet.size;
  const streak = weeklyStreak(dates, profile.days_per_week);
  const last30 = new Set(dates.filter((d) => d >= localDate(addDays(new Date(), -30)))).size;
  const efforts = sessions.map((s) => s.effort).filter((e): e is number => e != null);
  const avgEffort = efforts.length ? (efforts.reduce((a, b) => a + b, 0) / efforts.length).toFixed(1) : "—";

  // Calendario del mes
  const firstWeekday = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => localDate(new Date(month.getFullYear(), month.getMonth(), i + 1))),
  ];
  const monthCount = cells.filter((c) => c && dateSet.has(c)).length;
  const today = localDate();

  return (
    <div className="space-y-5">
      <PageHeader title="Progreso" subtitle="Tu constancia es tu superpoder" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Días entrenados" value={uniqueDays} />
        <Stat label="Últimos 30 días" value={last30} />
        <Stat label="Semanas en racha" value={streak} accent />
        <Stat label="Esfuerzo promedio" value={avgEffort} />
      </div>

      {/* Insights IA */}
      <Card className="border-brand/30 bg-gradient-to-br from-brand/10 to-transparent">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-semibold"><Sparkles className="h-5 w-5 text-brand" /> Insights del coach</p>
          <Button variant="secondary" onClick={generateInsights} loading={loadingInsight} className="px-3 py-1.5 text-xs">
            {!loadingInsight && <RefreshCw className="h-3.5 w-3.5" />} {insight ? "Actualizar" : "Generar"}
          </Button>
        </div>
        <ErrorNote message={insightError} />
        {insight ? (
          <div className="space-y-3">
            <p className="text-lg font-semibold">{insight.content.headline}</p>
            {insight.content.insights.map((it, i) => {
              const Icon = it.kind === "logro" ? Trophy : it.kind === "alerta" ? AlertTriangle : Lightbulb;
              const color = it.kind === "logro" ? "text-yellow-400" : it.kind === "alerta" ? "text-orange-400" : "text-sky-400";
              return (
                <div key={i} className="flex gap-3">
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} />
                  <div><p className="text-sm font-semibold">{it.title}</p><p className="text-sm text-slate-300">{it.text}</p></div>
                </div>
              );
            })}
            <div className="rounded-xl bg-slate-950/60 p-3 text-sm"><span className="font-semibold text-brand">Meta próxima semana: </span>{insight.content.next_week}</div>
            <p className="text-xs text-slate-500">Generado el {new Date(insight.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "long" })}</p>
          </div>
        ) : !insightError && (
          <p className="text-sm text-slate-400">Cuando tengas algunos entrenamientos registrados, el coach analizará tus hábitos y te dará recomendaciones según tu objetivo.</p>
        )}
      </Card>

      {/* Calendario */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-lg p-1 hover:bg-slate-800" aria-label="Mes anterior"><ChevronLeft className="h-5 w-5" /></button>
          <div className="text-center">
            <p className="font-semibold capitalize">{MONTHS[month.getMonth()]} {month.getFullYear()}</p>
            <p className="text-xs text-slate-400">{monthCount} días de gimnasio</p>
          </div>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-lg p-1 hover:bg-slate-800" aria-label="Mes siguiente"><ChevronRight className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {WEEKDAYS_SHORT.map((d, i) => <span key={i} className="text-xs text-slate-500">{d}</span>)}
          {cells.map((c, i) => (
            <div key={i} className={`flex aspect-square items-center justify-center rounded-lg text-sm ${
              !c ? "" : dateSet.has(c) ? "bg-brand font-bold text-slate-950" : c === today ? "border border-brand/60" : c > today ? "text-slate-700" : "bg-slate-800/60 text-slate-500"
            }`}>
              {c ? Number(c.slice(8)) : ""}
            </div>
          ))}
        </div>
      </Card>

      {/* Peso corporal */}
      <Card>
        <p className="mb-3 font-semibold">Peso corporal</p>
        {metrics.length >= 2 ? <Sparkline data={metrics} /> : (
          <p className="mb-3 text-sm text-slate-400">Registra tu peso cada semana para ver la tendencia.</p>
        )}
        <div className="mt-3 flex gap-2">
          <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" placeholder="Peso de hoy (kg)" className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-brand" />
          <Button onClick={saveWeight} disabled={!weight}>Guardar</Button>
        </div>
      </Card>

      {/* Historial */}
      <Card>
        <p className="mb-3 font-semibold">Historial</p>
        {sessions.length === 0 ? (
          <p className="text-sm text-slate-400">Aún no hay entrenamientos. <Link to="/coach" className="text-brand">Pide tu primera rutina</Link>.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {sessions.slice(0, 15).map((s) => {
              const mins = s.ended_at ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000) : null;
              return (
                <li key={s.id}>
                  <Link to={`/entreno/${s.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-brand">
                    <div>
                      <p className="font-medium">{s.routines?.title ?? "Entrenamiento libre"}</p>
                      <p className="text-xs text-slate-500">
                        {parseLocal(s.session_date).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "short" })}
                        {mins != null && ` · ${mins} min`}{!s.ended_at && " · en curso"}
                      </p>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      {s.mood && <span className="text-lg">{MOODS.find((m) => m.value === s.mood)?.emoji}</span>}
                      {s.effort != null && <p>esfuerzo {s.effort}/10</p>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <Card className="p-3">
      <p className={`text-2xl font-bold ${accent ? "text-orange-400" : ""}`}>{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </Card>
  );
}

function Sparkline({ data }: { data: Metric[] }) {
  const w = 300, h = 80, pad = 6;
  const vals = data.map((d) => Number(d.weight_kg));
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const pts = vals.map((v, i) => [pad + (i / (vals.length - 1)) * (w - 2 * pad), h - pad - ((v - min) / range) * (h - 2 * pad)]);
  const first = vals[0], last = vals[vals.length - 1];
  const diff = +(last - first).toFixed(1);
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold">{last} kg</span>
        <span className={`text-sm ${diff === 0 ? "text-slate-400" : diff < 0 ? "text-sky-400" : "text-orange-400"}`}>{diff > 0 ? "+" : ""}{diff} kg desde {parseLocal(data[0].measured_on).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full" preserveAspectRatio="none" role="img" aria-label="Tendencia de peso">
        <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="#a3e635" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

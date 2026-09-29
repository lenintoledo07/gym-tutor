// Insights: analiza asistencia, esfuerzo, progresión de cargas y peso corporal de las
// últimas 4 semanas y devuelve observaciones accionables según el objetivo del usuario.
import { authenticate, callClaude, handle, HttpError, json } from "../_shared/common.ts";

const MIN_HOURS_BETWEEN = 6;

const insightsTool = {
  name: "report_insights",
  description: "Entrega el análisis de hábitos y progreso del usuario.",
  input_schema: {
    type: "object",
    properties: {
      headline: { type: "string", description: "Titular de una frase sobre cómo va la persona" },
      insights: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["logro", "alerta", "sugerencia"] },
            title: { type: "string" },
            text: { type: "string", description: "1-2 frases concretas basadas en los datos" },
          },
          required: ["kind", "title", "text"],
        },
      },
      next_week: { type: "string", description: "Meta concreta y alcanzable para la próxima semana" },
    },
    required: ["headline", "insights", "next_week"],
  },
};

function isoWeekStart(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7; // lunes = 0
  x.setUTCDate(x.getUTCDate() - day);
  return x.toISOString().slice(0, 10);
}

Deno.serve(handle(async (req) => {
  const { user, admin } = await authenticate(req);
  const { force } = await req.json().catch(() => ({}));

  const { data: last } = await admin.from("insights").select("*").eq("user_id", user.id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (last && !force && Date.now() - new Date(last.created_at).getTime() < MIN_HOURS_BETWEEN * 3600 * 1000) {
    return json({ insight: last, cached: true });
  }
  if (last && Date.now() - new Date(last.created_at).getTime() < 3600 * 1000) {
    return json({ insight: last, cached: true });
  }

  const since = new Date(Date.now() - 28 * 86400 * 1000).toISOString().slice(0, 10);
  const [{ data: profile }, { data: sessions }, { data: sets }, { data: weights }] = await Promise.all([
    admin.from("profiles").select("*").eq("id", user.id).single(),
    admin.from("workout_sessions").select("session_date, started_at, ended_at, effort, routines(focus)")
      .eq("user_id", user.id).gte("session_date", since).order("session_date"),
    admin.from("set_logs").select("exercise_id, reps, weight_kg, created_at, exercises(name)")
      .eq("user_id", user.id).gte("created_at", since).order("created_at"),
    admin.from("body_metrics").select("measured_on, weight_kg").eq("user_id", user.id)
      .order("measured_on", { ascending: false }).limit(8),
  ]);
  if (!profile) throw new HttpError(404, "Perfil no encontrado");
  if (!sessions?.length) {
    throw new HttpError(400, "Aún no hay entrenamientos registrados. ¡Marca tu primera asistencia y vuelve aquí!");
  }

  // Asistencia por semana vs meta
  const weeks: Record<string, Set<string>> = {};
  for (const s of sessions) (weeks[isoWeekStart(new Date(s.session_date))] ??= new Set()).add(s.session_date);
  const weekly = Object.entries(weeks).sort().map(([w, days]) => `semana ${w}: ${days.size}/${profile.days_per_week} días`);

  const weekdays = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const byWeekday: Record<string, number> = {};
  for (const s of sessions) {
    const k = weekdays[new Date(s.session_date + "T12:00:00Z").getUTCDay()];
    byWeekday[k] = (byWeekday[k] ?? 0) + 1;
  }
  const efforts = sessions.map((s) => s.effort).filter((e): e is number => typeof e === "number");
  const durations = sessions.filter((s) => s.ended_at)
    .map((s) => Math.round((new Date(s.ended_at!).getTime() - new Date(s.started_at).getTime()) / 60000));
  const focuses = sessions.map((s: any) => s.routines?.focus).filter(Boolean);

  // Progresión de cargas por ejercicio (primer vs último registro)
  const prog: Record<string, { name: string; first: number; last: number; n: number }> = {};
  for (const s of sets ?? []) {
    if (s.weight_kg == null) continue;
    const w = Number(s.weight_kg);
    const p = (prog[s.exercise_id] ??= { name: (s as any).exercises?.name ?? s.exercise_id, first: w, last: w, n: 0 });
    p.last = w; p.n++;
  }
  const progression = Object.values(prog).filter((p) => p.n >= 2)
    .map((p) => `${p.name}: ${p.first} kg → ${p.last} kg`).slice(0, 10);

  const data = [
    `Objetivo: ${profile.goal ?? "no definido"}; nivel ${profile.level}; meta ${profile.days_per_week} días/semana de ${profile.session_minutes} min.`,
    `Asistencia últimas 4 semanas: ${weekly.join("; ")}`,
    `Días de la semana que más asiste: ${JSON.stringify(byWeekday)}`,
    `Esfuerzo percibido (1-10): ${efforts.join(", ") || "sin datos"}`,
    `Duración real de sesiones (min): ${durations.join(", ") || "sin datos"}`,
    `Grupos trabajados: ${focuses.join("; ") || "sin datos"}`,
    `Progresión de cargas: ${progression.join("; ") || "sin datos suficientes"}`,
    `Peso corporal reciente: ${(weights ?? []).map((w) => `${w.measured_on}: ${w.weight_kg} kg`).join("; ") || "sin registros"}`,
  ].join("\n");

  const blocks = await callClaude({
    system: [{
      type: "text",
      text: `Eres un coach de hábitos para principiantes de gimnasio. Analizas datos reales y das insights en español, cercanos, honestos y accionables. Celebra la constancia, señala patrones (días que falla, grupos descuidados, esfuerzo muy alto o muy bajo, estancamiento de cargas) y relaciona todo con el objetivo. No hagas diagnósticos médicos ni recomiendes suplementos. No inventes datos que no aparezcan.`,
    }],
    messages: [{ role: "user", content: `Datos del usuario:\n${data}` }],
    tools: [insightsTool],
    tool_choice: { type: "tool", name: "report_insights" },
    max_tokens: 1200,
  });

  const toolUse = blocks.find((b) => b.type === "tool_use") as any;
  if (!toolUse) throw new HttpError(502, "No se pudieron generar los insights");

  const { data: saved, error } = await admin.from("insights")
    .insert({ user_id: user.id, content: toolUse.input }).select().single();
  if (error) throw error;
  return json({ insight: saved, cached: false });
}));

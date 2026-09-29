// Coach IA: conversa con el usuario y, cuando corresponde, arma una rutina de 4-5 ejercicios
// usando EXCLUSIVAMENTE ejercicios del catálogo (para que siempre haya imagen de ejecución).
import { authenticate, callClaude, handle, HttpError, json } from "../_shared/common.ts";

const MAX_MESSAGES_PER_DAY = 40;

const GOAL_LABEL: Record<string, string> = {
  perder_grasa: "perder grasa",
  ganar_musculo: "ganar masa muscular",
  fuerza: "ganar fuerza",
  salud_general: "salud general y sentirse bien",
  resistencia: "mejorar resistencia",
};

const routineTool = {
  name: "create_routine",
  description:
    "Crea una rutina de gimnasio de 4 a 5 ejercicios para la sesión de hoy. Úsala cuando el usuario pida qué entrenar, una rutina o ejercicios.",
  input_schema: {
    type: "object",
    properties: {
      message: { type: "string", description: "Mensaje breve y motivador al usuario (2-4 frases) explicando la rutina." },
      title: { type: "string", description: "Nombre corto de la rutina, ej. 'Tren inferior para principiantes'" },
      focus: { type: "string", description: "Grupos musculares principales, ej. 'Piernas y glúteos'" },
      warmup: { type: "string", description: "Calentamiento sugerido de 5-8 minutos" },
      notes: { type: "string", description: "Consejos de seguridad o progresión para esta sesión" },
      exercises: {
        type: "array",
        minItems: 4,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            exercise_id: { type: "string", description: "id EXACTO del catálogo" },
            display_name: { type: "string", description: "Nombre del ejercicio en español" },
            sets: { type: "integer", minimum: 1, maximum: 6 },
            reps: { type: "string", description: "ej. '10-12', '30 s', '8 por lado'" },
            rest_seconds: { type: "integer", minimum: 15, maximum: 240 },
            cues: {
              type: "array",
              items: { type: "string" },
              minItems: 2,
              maxItems: 4,
              description: "Claves de técnica en español, cortas y concretas",
            },
          },
          required: ["exercise_id", "display_name", "sets", "reps", "rest_seconds", "cues"],
        },
      },
    },
    required: ["message", "title", "focus", "warmup", "exercises"],
  },
};

Deno.serve(handle(async (req) => {
  const { user, admin } = await authenticate(req);
  const { message } = await req.json().catch(() => ({}));
  if (typeof message !== "string" || !message.trim()) throw new HttpError(400, "Escribe un mensaje");
  const text = message.trim().slice(0, 1500);

  // Límite diario simple para controlar costos
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from("coach_messages").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).eq("role", "user").gte("created_at", since);
  if ((count ?? 0) >= MAX_MESSAGES_PER_DAY) {
    throw new HttpError(429, "Llegaste al límite de mensajes de hoy. ¡Mañana seguimos!");
  }

  const [{ data: profile }, { data: history }, { data: sessions }, { data: lastRoutines }] = await Promise.all([
    admin.from("profiles").select("*").eq("id", user.id).single(),
    admin.from("coach_messages").select("role, content").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(8),
    admin.from("workout_sessions").select("session_date, effort, routines(title, focus)")
      .eq("user_id", user.id).order("session_date", { ascending: false }).limit(6),
    admin.from("routines").select("title, focus, created_at, routine_exercises(exercise_id)")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
  ]);
  if (!profile) throw new HttpError(404, "Perfil no encontrado");

  // Catálogo candidato según nivel y equipamiento disponible
  const levels = profile.level === "intermedio" ? ["beginner", "intermediate"] : ["beginner"];
  const equipment = Array.from(new Set([...(profile.equipment ?? []), "body only"]));
  const { data: catalog, error: catErr } = await admin.from("exercises")
    .select("id, name, primary_muscles, equipment, category")
    .in("level", levels)
    .in("category", ["strength", "stretching", "cardio", "plyometrics"])
    .in("equipment", equipment)
    .order("id");
  if (catErr) throw catErr;
  const catalogIds = new Set(catalog!.map((e) => e.id));
  const catalogText = catalog!
    .map((e) => `${e.id}|${e.name}|${e.primary_muscles.join(",")}|${e.equipment}|${e.category}`)
    .join("\n");

  const age = profile.birth_year ? new Date().getFullYear() - profile.birth_year : null;
  const userContext = [
    `Nombre: ${profile.full_name ?? "usuario"}`,
    `Objetivo: ${GOAL_LABEL[profile.goal] ?? "no definido"}`,
    `Nivel: ${profile.level}`,
    `Días por semana planificados: ${profile.days_per_week}`,
    `Duración de sesión: ${profile.session_minutes} min`,
    age ? `Edad aprox.: ${age}` : null,
    profile.sex ? `Sexo: ${profile.sex}` : null,
    profile.limitations ? `Limitaciones/molestias declaradas: ${profile.limitations}` : "Sin limitaciones declaradas",
    `Últimas sesiones: ${
      (sessions ?? []).map((s: any) => `${s.session_date} (${s.routines?.focus ?? "libre"}, esfuerzo ${s.effort ?? "?"}/10)`).join("; ") || "ninguna todavía"
    }`,
    `Rutinas recientes: ${
      (lastRoutines ?? []).map((r: any) => `${r.title} [${r.routine_exercises.map((x: any) => x.exercise_id).join(", ")}]`).join(" | ") || "ninguna"
    }`,
  ].filter(Boolean).join("\n");

  const system = [
    {
      type: "text" as const,
      text: `Eres "Coach", un entrenador personal amable y claro para PRINCIPIANTES en el gimnasio. Respondes siempre en español neutro, breve y motivador.

Reglas:
- Cuando el usuario pida qué entrenar, una rutina o ejercicios, llama a la herramienta create_routine con 4 o 5 ejercicios.
- Usa SOLO exercise_id que aparezcan EXACTAMENTE en el catálogo. Nunca inventes ids.
- Ordena: primero multiarticulares/grandes grupos, luego accesorios; si hay tiempo, termina con core o estiramiento.
- Principiantes: 2-3 series, 8-15 repeticiones, técnica antes que peso, descansos de 60-90 s. Ajusta a la duración de la sesión.
- Evita repetir exactamente la última rutina y equilibra los grupos musculares según las últimas sesiones (no entrenes fuerte el mismo grupo en días consecutivos).
- Respeta las limitaciones declaradas: evita ejercicios que carguen esa zona. Si el usuario menciona dolor agudo, lesión, mareos o una condición médica, recomiéndale consultar a un profesional de la salud antes de entrenar y ofrece solo opciones suaves.
- Para preguntas generales (técnica, respiración, alimentación básica, motivación) responde en texto sin crear rutina. No des indicaciones médicas ni de suplementos/fármacos.
- display_name siempre en español (ej. "Sentadilla goblet con mancuerna").

Perfil del usuario:
${userContext}`,
    },
    {
      type: "text" as const,
      text: `Catálogo disponible (id|nombre en inglés|músculos principales|equipo|categoría):\n${catalogText}`,
      cache_control: { type: "ephemeral" as const },
    },
  ];

  const messages = [
    ...(history ?? []).reverse().map((m: any) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: text },
  ];
  // La API exige que el primer mensaje sea del usuario
  while (messages.length && messages[0].role !== "user") messages.shift();

  const blocks = await callClaude({ system, messages, tools: [routineTool], tool_choice: { type: "auto" }, max_tokens: 2500 });

  await admin.from("coach_messages").insert({ user_id: user.id, role: "user", content: text });

  const toolUse = blocks.find((b) => b.type === "tool_use" && b.name === "create_routine") as any;
  const textReply = blocks.filter((b) => b.type === "text").map((b: any) => b.text).join("\n").trim();

  if (!toolUse) {
    const reply = textReply || "¿Me cuentas un poco más de lo que quieres entrenar hoy?";
    await admin.from("coach_messages").insert({ user_id: user.id, role: "assistant", content: reply });
    return json({ message: reply, routine: null });
  }

  const input = toolUse.input as any;
  const valid = (input.exercises ?? []).filter((x: any) => catalogIds.has(x.exercise_id)).slice(0, 5);
  if (valid.length < 3) throw new HttpError(502, "El coach no pudo armar una rutina válida. Intenta reformular tu pedido.");

  const { data: routine, error: rErr } = await admin.from("routines").insert({
    user_id: user.id,
    title: String(input.title).slice(0, 120),
    focus: input.focus ?? null,
    warmup: input.warmup ?? null,
    notes: input.notes ?? null,
    request: text,
  }).select().single();
  if (rErr) throw rErr;

  const { error: reErr } = await admin.from("routine_exercises").insert(valid.map((x: any, i: number) => ({
    routine_id: routine.id,
    exercise_id: x.exercise_id,
    position: i + 1,
    display_name: String(x.display_name).slice(0, 120),
    sets: Math.min(Math.max(Number(x.sets) || 3, 1), 6),
    reps: String(x.reps).slice(0, 30),
    rest_seconds: Math.min(Math.max(Number(x.rest_seconds) || 60, 15), 240),
    cues: (x.cues ?? []).slice(0, 4).map((c: unknown) => String(c).slice(0, 200)),
  })));
  if (reErr) throw reErr;

  const reply = input.message || textReply || `Aquí tienes tu rutina: ${routine.title}`;
  await admin.from("coach_messages").insert({ user_id: user.id, role: "assistant", content: reply, routine_id: routine.id });

  return json({ message: reply, routine_id: routine.id });
}));

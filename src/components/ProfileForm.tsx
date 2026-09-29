import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/types";
import { EQUIPMENT, GOALS } from "../lib/labels";
import { Button, Chip, ErrorNote } from "./ui";

const input = "w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm outline-none focus:border-brand";

export default function ProfileForm({ profile, submitLabel, onSaved }: {
  profile: Profile; submitLabel: string; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    full_name: profile.full_name ?? "",
    goal: profile.goal ?? "salud_general",
    level: profile.level,
    days_per_week: profile.days_per_week,
    session_minutes: profile.session_minutes,
    equipment: profile.equipment,
    limitations: profile.limitations ?? "",
    sex: profile.sex ?? "",
    birth_year: profile.birth_year?.toString() ?? "",
    height_cm: profile.height_cm?.toString() ?? "",
    weight_kg: profile.weight_kg?.toString() ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.equipment.length) { setError("Elige al menos un tipo de equipamiento"); return; }
    setSaving(true);
    setError(null);
    const num = (s: string) => (s.trim() ? Number(s) : null);
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name.trim() || null,
      goal: form.goal,
      level: form.level,
      days_per_week: form.days_per_week,
      session_minutes: form.session_minutes,
      equipment: form.equipment,
      limitations: form.limitations.trim() || null,
      sex: form.sex || null,
      birth_year: num(form.birth_year),
      height_cm: num(form.height_cm),
      weight_kg: num(form.weight_kg),
      onboarded: true,
    }).eq("id", profile.id);
    setSaving(false);
    if (error) { setError(error.message); return; }
    // Registra el peso inicial/actual en el historial
    if (form.weight_kg.trim()) {
      const today = new Date();
      const d = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      await supabase.from("body_metrics").upsert(
        { user_id: profile.id, measured_on: d, weight_kg: Number(form.weight_kg) },
        { onConflict: "user_id,measured_on" },
      );
    }
    onSaved();
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section>
        <label className="mb-2 block text-sm font-medium">¿Cómo te llamas?</label>
        <input className={input} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="Tu nombre" />
      </section>

      <section>
        <p className="mb-2 text-sm font-medium">¿Cuál es tu objetivo principal?</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {GOALS.map((g) => (
            <button
              type="button"
              key={g.value}
              onClick={() => set("goal", g.value)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                form.goal === g.value ? "border-brand bg-brand/10" : "border-slate-700 hover:border-slate-500"
              }`}
            >
              <span className="text-2xl">{g.emoji}</span>
              <span>
                <span className="block text-sm font-semibold">{g.label}</span>
                <span className="block text-xs text-slate-400">{g.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-2 text-sm font-medium">Tu experiencia en el gimnasio</p>
        <div className="flex flex-wrap gap-2">
          <Chip active={form.level === "principiante"} onClick={() => set("level", "principiante")}>Recién empiezo</Chip>
          <Chip active={form.level === "intermedio"} onClick={() => set("level", "intermedio")}>Ya tengo algo de práctica</Chip>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium">Días por semana: <span className="text-brand">{form.days_per_week}</span></p>
          <input type="range" min={1} max={7} value={form.days_per_week} onChange={(e) => set("days_per_week", Number(e.target.value))} className="w-full accent-lime-400" />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Minutos por sesión: <span className="text-brand">{form.session_minutes}</span></p>
          <input type="range" min={20} max={120} step={5} value={form.session_minutes} onChange={(e) => set("session_minutes", Number(e.target.value))} className="w-full accent-lime-400" />
        </div>
      </section>

      <section>
        <p className="mb-2 text-sm font-medium">¿Qué equipamiento tienes disponible?</p>
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT.map((eq) => (
            <Chip
              key={eq.value}
              active={form.equipment.includes(eq.value)}
              onClick={() => set("equipment", form.equipment.includes(eq.value)
                ? form.equipment.filter((x) => x !== eq.value)
                : [...form.equipment, eq.value])}
            >
              {eq.label}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <label className="mb-2 block text-sm font-medium">¿Alguna molestia o zona que debamos cuidar? (opcional)</label>
        <textarea className={input} rows={2} value={form.limitations} onChange={(e) => set("limitations", e.target.value)} placeholder="Ej: molestia en rodilla derecha, evitar saltos" />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs text-slate-400">Sexo</label>
          <select className={input} value={form.sex} onChange={(e) => set("sex", e.target.value)}>
            <option value="">—</option><option value="hombre">Hombre</option><option value="mujer">Mujer</option><option value="otro">Otro</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Año de nacimiento</label>
          <input className={input} inputMode="numeric" value={form.birth_year} onChange={(e) => set("birth_year", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1995" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Altura (cm)</label>
          <input className={input} inputMode="decimal" value={form.height_cm} onChange={(e) => set("height_cm", e.target.value)} placeholder="170" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Peso (kg)</label>
          <input className={input} inputMode="decimal" value={form.weight_kg} onChange={(e) => set("weight_kg", e.target.value)} placeholder="70" />
        </div>
      </section>

      <ErrorNote message={error} />
      <Button type="submit" loading={saving} className="w-full py-3">{submitLabel}</Button>
    </form>
  );
}

import { useEffect, useState } from "react";
import { Search, X, Video } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { Exercise } from "../lib/types";
import { CATEGORY, equipmentLabel, EQUIPMENT, LEVEL, MUSCLES, muscleLabel, youtubeUrl } from "../lib/labels";
import ExerciseMedia from "../components/ExerciseMedia";
import { Chip, PageHeader, Spinner } from "../components/ui";

const PAGE = 24;

export default function Exercises() {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [beginnerOnly, setBeginnerOnly] = useState(true);
  const [items, setItems] = useState<Exercise[] | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<Exercise | null>(null);

  useEffect(() => { setLimit(PAGE); }, [q, muscle, equipment, beginnerOnly]);

  useEffect(() => {
    const t = setTimeout(async () => {
      let query = supabase.from("exercises").select("*").order("name").limit(limit + 1);
      if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);
      if (muscle) query = query.contains("primary_muscles", [muscle]);
      if (equipment) query = query.eq("equipment", equipment);
      if (beginnerOnly) query = query.eq("level", "beginner");
      const { data } = await query;
      const rows = (data ?? []) as Exercise[];
      setHasMore(rows.length > limit);
      setItems(rows.slice(0, limit));
    }, 250);
    return () => clearTimeout(t);
  }, [q, muscle, equipment, beginnerOnly, limit]);

  return (
    <div>
      <PageHeader title="Ejercicios" subtitle="Biblioteca con más de 800 ejercicios y su ejecución" />

      <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3">
        <Search className="h-4 w-4 text-slate-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar (nombres en inglés): squat, row, plank..." className="flex-1 bg-transparent py-2.5 text-sm outline-none" />
      </div>

      <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
        <Chip active={beginnerOnly} onClick={() => setBeginnerOnly(!beginnerOnly)}>Solo principiante</Chip>
        {Object.entries(MUSCLES).map(([k, v]) => (
          <Chip key={k} active={muscle === k} onClick={() => setMuscle(muscle === k ? null : k)}>{v}</Chip>
        ))}
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {EQUIPMENT.map((e) => (
          <Chip key={e.value} active={equipment === e.value} onClick={() => setEquipment(equipment === e.value ? null : e.value)}>{e.label}</Chip>
        ))}
      </div>

      {!items ? <Spinner /> : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">No encontramos ejercicios con esos filtros.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((ex) => (
              <button key={ex.id} onClick={() => setSelected(ex)} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-left transition hover:border-slate-600">
                <ExerciseMedia images={ex.images.slice(0, 1)} alt={ex.name} className="aspect-[4/3] w-full" />
                <div className="p-2.5">
                  <p className="line-clamp-2 text-sm font-semibold leading-tight">{ex.name}</p>
                  <p className="mt-1 text-xs text-slate-400">{ex.primary_muscles.map(muscleLabel).join(", ")}</p>
                </div>
              </button>
            ))}
          </div>
          {hasMore && (
            <button onClick={() => setLimit((l) => l + PAGE)} className="mt-4 w-full rounded-xl border border-slate-700 py-2.5 text-sm text-slate-300 hover:border-slate-500">Ver más</button>
          )}
        </>
      )}

      {selected && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setSelected(null)}>
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-slate-800 bg-slate-900 p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="text-xl font-bold">{selected.name}</h2>
              <button onClick={() => setSelected(null)} className="rounded-lg p-1 hover:bg-slate-800" aria-label="Cerrar"><X className="h-5 w-5" /></button>
            </div>
            <ExerciseMedia images={selected.images} alt={selected.name} className="mb-4 aspect-[4/3] w-full rounded-2xl" />
            <div className="mb-4 flex flex-wrap gap-1.5 text-xs">
              {selected.primary_muscles.map((m) => <span key={m} className="rounded-full bg-brand/15 px-2 py-0.5 text-brand">{muscleLabel(m)}</span>)}
              {selected.secondary_muscles.map((m) => <span key={m} className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-400">{muscleLabel(m)}</span>)}
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">{equipmentLabel(selected.equipment)}</span>
              {selected.level && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">{LEVEL[selected.level] ?? selected.level}</span>}
              {selected.category && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">{CATEGORY[selected.category] ?? selected.category}</span>}
            </div>
            <p className="mb-2 text-sm font-semibold">Instrucciones <span className="font-normal text-slate-500">(en inglés)</span></p>
            <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-sm text-slate-300">
              {selected.instructions.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
            <a href={youtubeUrl(selected.name)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-red-600/15 px-3 py-2 text-sm text-red-300 hover:bg-red-600/25">
              <Video className="h-4 w-4" /> Ver video en YouTube
            </a>
            <p className="mt-4 text-xs text-slate-500">Tip: pídele al coach que te explique este ejercicio en español.</p>
          </div>
        </div>
      )}
    </div>
  );
}

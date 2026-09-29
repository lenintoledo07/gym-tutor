import { useState } from "react";
import { ChevronDown, Clock, Flame, Info, PlayCircle, Video } from "lucide-react";
import type { Routine } from "../lib/types";
import { muscleLabel, youtubeUrl } from "../lib/labels";
import ExerciseMedia from "./ExerciseMedia";

export default function RoutineView({ routine, compact = false }: { routine: Routine; compact?: boolean }) {
  const [open, setOpen] = useState<string | null>(compact ? null : routine.routine_exercises?.[0]?.id ?? null);
  const items = routine.routine_exercises ?? [];

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-bold">{routine.title}</h3>
        {routine.focus && <p className="text-sm text-brand">{routine.focus}</p>}
      </div>

      {routine.warmup && (
        <div className="flex gap-2 rounded-xl bg-orange-500/10 p-3 text-sm text-orange-200">
          <Flame className="mt-0.5 h-4 w-4 shrink-0" />
          <p><span className="font-semibold">Calentamiento: </span>{routine.warmup}</p>
        </div>
      )}

      <ol className="space-y-2">
        {items.map((it, idx) => {
          const ex = it.exercises;
          const isOpen = open === it.id;
          return (
            <li key={it.id} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
              <button type="button" onClick={() => setOpen(isOpen ? null : it.id)} className="flex w-full items-center gap-3 p-2.5 text-left">
                <ExerciseMedia images={ex?.images ?? []} alt={it.display_name} className="h-16 w-16 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500">Ejercicio {idx + 1}</p>
                  <p className="truncate font-semibold">{it.display_name}</p>
                  <p className="text-sm text-slate-400">
                    {it.sets} × {it.reps} <span className="text-slate-600">·</span>{" "}
                    <Clock className="inline h-3.5 w-3.5" /> {it.rest_seconds}s
                  </p>
                </div>
                <ChevronDown className={`h-5 w-5 text-slate-500 transition ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="space-y-3 border-t border-slate-800 p-3">
                  <ExerciseMedia images={ex?.images ?? []} alt={it.display_name} className="mx-auto aspect-[4/3] w-full max-w-sm rounded-xl" />
                  {ex && (
                    <div className="flex flex-wrap gap-1.5">
                      {ex.primary_muscles.map((m) => (
                        <span key={m} className="rounded-full bg-brand/15 px-2 py-0.5 text-xs text-brand">{muscleLabel(m)}</span>
                      ))}
                      {ex.secondary_muscles.map((m) => (
                        <span key={m} className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">{muscleLabel(m)}</span>
                      ))}
                    </div>
                  )}
                  {it.cues.length > 0 && (
                    <ul className="space-y-1.5 text-sm">
                      {it.cues.map((c, i) => (
                        <li key={i} className="flex gap-2"><span className="text-brand">✓</span>{c}</li>
                      ))}
                    </ul>
                  )}
                  <a
                    href={youtubeUrl(it.display_name)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600/15 px-3 py-2 text-sm text-red-300 hover:bg-red-600/25"
                  >
                    <Video className="h-4 w-4" /> Ver video de la técnica
                  </a>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {routine.notes && (
        <div className="flex gap-2 rounded-xl bg-sky-500/10 p-3 text-sm text-sky-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{routine.notes}</p>
        </div>
      )}
      {compact && (
        <p className="flex items-center gap-1 text-xs text-slate-500"><PlayCircle className="h-3.5 w-3.5" /> Toca un ejercicio para ver cómo se hace</p>
      )}
    </div>
  );
}

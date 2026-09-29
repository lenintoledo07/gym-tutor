import { supabase } from "./supabase";
import { localDate } from "./dates";
import type { Routine, WorkoutSession } from "./types";

export async function fetchRoutine(id: string): Promise<Routine | null> {
  const { data } = await supabase
    .from("routines")
    .select("*, routine_exercises(*, exercises(*))")
    .eq("id", id)
    .order("position", { referencedTable: "routine_exercises" })
    .maybeSingle();
  return data as Routine | null;
}

/** Crea una sesión (marca asistencia) para hoy, opcionalmente asociada a una rutina. */
export async function startSession(userId: string, routineId: string | null): Promise<WorkoutSession> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({ user_id: userId, routine_id: routineId, session_date: localDate() })
    .select()
    .single();
  if (error) throw error;
  return data as WorkoutSession;
}

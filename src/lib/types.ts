export type Goal = "perder_grasa" | "ganar_musculo" | "fuerza" | "salud_general" | "resistencia";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  goal: Goal | null;
  level: "principiante" | "intermedio";
  days_per_week: number;
  session_minutes: number;
  equipment: string[];
  limitations: string | null;
  sex: "hombre" | "mujer" | "otro" | null;
  birth_year: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  onboarded: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  force: string | null;
  level: string | null;
  mechanic: string | null;
  equipment: string | null;
  category: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  instructions: string[];
  images: string[];
}

export interface RoutineExercise {
  id: string;
  routine_id: string;
  exercise_id: string;
  position: number;
  display_name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  cues: string[];
  exercises?: Exercise;
}

export interface Routine {
  id: string;
  title: string;
  focus: string | null;
  warmup: string | null;
  notes: string | null;
  request: string | null;
  created_at: string;
  routine_exercises?: RoutineExercise[];
}

export interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  routine_id: string | null;
  created_at: string;
}

export interface WorkoutSession {
  id: string;
  routine_id: string | null;
  session_date: string;
  started_at: string;
  ended_at: string | null;
  effort: number | null;
  mood: string | null;
  notes: string | null;
}

export interface SetLog {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  created_at: string;
}

export interface InsightContent {
  headline: string;
  insights: { kind: "logro" | "alerta" | "sugerencia"; title: string; text: string }[];
  next_week: string;
}

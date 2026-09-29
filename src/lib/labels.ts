import type { Goal } from "./types";

export const GOALS: { value: Goal; label: string; emoji: string; hint: string }[] = [
  { value: "perder_grasa", label: "Perder grasa", emoji: "🔥", hint: "Circuitos y más gasto calórico" },
  { value: "ganar_musculo", label: "Ganar músculo", emoji: "💪", hint: "Hipertrofia, 8-12 repeticiones" },
  { value: "fuerza", label: "Ganar fuerza", emoji: "🏋️", hint: "Básicos con progresión de carga" },
  { value: "salud_general", label: "Salud y bienestar", emoji: "🌱", hint: "Moverte mejor y sentirte bien" },
  { value: "resistencia", label: "Resistencia", emoji: "🫀", hint: "Más aguante y capacidad aeróbica" },
];

export const EQUIPMENT: { value: string; label: string }[] = [
  { value: "body only", label: "Peso corporal" },
  { value: "dumbbell", label: "Mancuernas" },
  { value: "barbell", label: "Barra" },
  { value: "machine", label: "Máquinas" },
  { value: "cable", label: "Poleas" },
  { value: "kettlebells", label: "Kettlebells" },
  { value: "bands", label: "Bandas elásticas" },
  { value: "e-z curl bar", label: "Barra Z" },
  { value: "medicine ball", label: "Balón medicinal" },
  { value: "exercise ball", label: "Fitball" },
  { value: "foam roll", label: "Foam roller" },
  { value: "other", label: "Otros" },
];

export const MUSCLES: Record<string, string> = {
  abdominals: "Abdominales",
  abductors: "Abductores",
  adductors: "Aductores",
  biceps: "Bíceps",
  calves: "Pantorrillas",
  chest: "Pecho",
  forearms: "Antebrazos",
  glutes: "Glúteos",
  hamstrings: "Isquiotibiales",
  lats: "Dorsales",
  "lower back": "Zona lumbar",
  "middle back": "Espalda media",
  neck: "Cuello",
  quadriceps: "Cuádriceps",
  shoulders: "Hombros",
  traps: "Trapecios",
  triceps: "Tríceps",
};

export const CATEGORY: Record<string, string> = {
  strength: "Fuerza",
  stretching: "Estiramiento",
  plyometrics: "Pliometría",
  cardio: "Cardio",
  powerlifting: "Powerlifting",
  "olympic weightlifting": "Halterofilia",
  strongman: "Strongman",
};

export const LEVEL: Record<string, string> = { beginner: "Principiante", intermediate: "Intermedio", expert: "Avanzado" };

export const equipmentLabel = (v: string | null) => EQUIPMENT.find((e) => e.value === v)?.label ?? "Sin equipo";
export const muscleLabel = (v: string) => MUSCLES[v] ?? v;

export function youtubeUrl(name: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} técnica correcta`)}`;
}

export const MOODS = [
  { value: "agotado", emoji: "😮‍💨" },
  { value: "normal", emoji: "🙂" },
  { value: "bien", emoji: "😄" },
  { value: "imparable", emoji: "🔥" },
];

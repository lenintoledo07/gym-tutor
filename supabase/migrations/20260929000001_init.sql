-- Gym Tutor: esquema inicial
create extension if not exists pgcrypto;

-- Perfiles ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  goal text check (goal in ('perder_grasa','ganar_musculo','fuerza','salud_general','resistencia')),
  level text not null default 'principiante' check (level in ('principiante','intermedio')),
  days_per_week int not null default 3 check (days_per_week between 1 and 7),
  session_minutes int not null default 45 check (session_minutes between 15 and 180),
  equipment text[] not null default array['body only','dumbbell','machine','cable','barbell'],
  limitations text,
  sex text check (sex in ('hombre','mujer','otro')),
  birth_year int check (birth_year between 1920 and 2020),
  height_cm numeric(5,1),
  weight_kg numeric(5,1),
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Catálogo de ejercicios (free-exercise-db, dominio público) --------
create table public.exercises (
  id text primary key,
  name text not null,
  force text,
  level text,
  mechanic text,
  equipment text,
  category text,
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  instructions text[] not null default '{}',
  images text[] not null default '{}'
);
create index exercises_level_idx on public.exercises(level);
create index exercises_equipment_idx on public.exercises(equipment);
create index exercises_primary_idx on public.exercises using gin(primary_muscles);

-- Rutinas generadas por el coach -------------------------------------
create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  focus text,
  warmup text,
  notes text,
  request text,
  created_at timestamptz not null default now()
);
create index routines_user_idx on public.routines(user_id, created_at desc);

create table public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  exercise_id text not null references public.exercises(id),
  position int not null,
  display_name text not null,
  sets int not null check (sets between 1 and 10),
  reps text not null,
  rest_seconds int not null default 60,
  cues text[] not null default '{}'
);
create index routine_ex_routine_idx on public.routine_exercises(routine_id, position);

-- Conversación con el coach ------------------------------------------
create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  routine_id uuid references public.routines(id) on delete set null,
  created_at timestamptz not null default now()
);
create index coach_messages_user_idx on public.coach_messages(user_id, created_at desc);

-- Asistencia / sesiones de entrenamiento ------------------------------
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid references public.routines(id) on delete set null,
  session_date date not null default current_date,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  effort int check (effort between 1 and 10),
  mood text,
  notes text
);
create index sessions_user_date_idx on public.workout_sessions(user_id, session_date desc);

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null references public.exercises(id),
  set_number int not null,
  reps int,
  weight_kg numeric(6,2),
  created_at timestamptz not null default now(),
  unique (session_id, exercise_id, set_number)
);
create index set_logs_user_ex_idx on public.set_logs(user_id, exercise_id, created_at desc);

-- Peso corporal (para insights de progreso) ---------------------------
create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric(5,1) not null,
  unique (user_id, measured_on)
);

-- Insights semanales generados por IA ---------------------------------
create table public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content jsonb not null,
  created_at timestamptz not null default now()
);
create index insights_user_idx on public.insights(user_id, created_at desc);

-- RLS -----------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.routines enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.coach_messages enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.set_logs enable row level security;
alter table public.body_metrics enable row level security;
alter table public.insights enable row level security;

create policy "perfil propio: leer" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "perfil propio: editar" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "catalogo: leer" on public.exercises for select to authenticated using (true);

-- Rutinas y mensajes los escribe la Edge Function (service role); el usuario solo lee/borra.
create policy "rutinas propias: leer" on public.routines for select to authenticated using ((select auth.uid()) = user_id);
create policy "rutinas propias: borrar" on public.routines for delete to authenticated using ((select auth.uid()) = user_id);
create policy "ejercicios de rutina propia: leer" on public.routine_exercises for select to authenticated
  using (exists (select 1 from public.routines r where r.id = routine_id and r.user_id = (select auth.uid())));
create policy "mensajes propios: leer" on public.coach_messages for select to authenticated using ((select auth.uid()) = user_id);

create policy "sesiones propias" on public.workout_sessions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (routine_id is null or exists (
    select 1 from public.routines r where r.id = routine_id and r.user_id = (select auth.uid()))));
create policy "series propias" on public.set_logs for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
create policy "peso propio" on public.body_metrics for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "insights propios: leer" on public.insights for select to authenticated using ((select auth.uid()) = user_id);

revoke execute on function public.handle_new_user() from public, anon, authenticated;

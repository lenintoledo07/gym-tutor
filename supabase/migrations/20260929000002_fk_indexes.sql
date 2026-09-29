create index if not exists coach_messages_routine_idx on public.coach_messages(routine_id);
create index if not exists routine_exercises_exercise_idx on public.routine_exercises(exercise_id);
create index if not exists set_logs_exercise_idx on public.set_logs(exercise_id);
create index if not exists workout_sessions_routine_idx on public.workout_sessions(routine_id);

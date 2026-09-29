-- Carga el catálogo abierto free-exercise-db (https://github.com/yuhonas/free-exercise-db, licencia Unlicense)
-- directamente desde GitHub usando la extensión http. Idempotente.
create extension if not exists http with schema extensions;

with src as (
  select (extensions.http_get('https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json')).content::jsonb as data
), rows as (
  select jsonb_array_elements(data) as e from src
)
insert into public.exercises (id, name, force, level, mechanic, equipment, category,
                              primary_muscles, secondary_muscles, instructions, images)
select e->>'id', e->>'name', e->>'force', e->>'level', e->>'mechanic', e->>'equipment', e->>'category',
       coalesce(array(select jsonb_array_elements_text(e->'primaryMuscles')), '{}'),
       coalesce(array(select jsonb_array_elements_text(e->'secondaryMuscles')), '{}'),
       coalesce(array(select jsonb_array_elements_text(e->'instructions')), '{}'),
       coalesce(array(select 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/' || i
                      from jsonb_array_elements_text(e->'images') i), '{}')
from rows
on conflict (id) do update set
  name = excluded.name, force = excluded.force, level = excluded.level, mechanic = excluded.mechanic,
  equipment = excluded.equipment, category = excluded.category, primary_muscles = excluded.primary_muscles,
  secondary_muscles = excluded.secondary_muscles, instructions = excluded.instructions, images = excluded.images;

drop extension if exists http;

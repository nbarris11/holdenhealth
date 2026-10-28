-- Optional working weight and reps are saved with the member's existing workout log.
-- Existing logs and access policies remain unchanged.
alter table public.challenge_workout_logs
  add column exercise_loads jsonb not null default '[]'::jsonb
  check (jsonb_typeof(exercise_loads) = 'array'
    and jsonb_array_length(exercise_loads) <= 40
    and octet_length(exercise_loads::text) <= 10000);

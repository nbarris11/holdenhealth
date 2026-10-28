-- Optional presets inherit the existing workout ownership/publication policies.
alter table public.challenge_workouts add column timer_config jsonb;
alter table public.challenge_workouts add constraint workout_timer_valid check (
 timer_config is null or coalesce((
 jsonb_typeof(timer_config)='object'
 and jsonb_typeof(timer_config->'durationSeconds')='number'
 and jsonb_typeof(timer_config->'workSeconds')='number'
 and jsonb_typeof(timer_config->'restSeconds')='number'
 and jsonb_typeof(timer_config->'rounds')='number'
 and timer_config->>'mode' in ('countdown','stopwatch','emom','interval')
 and (timer_config->>'durationSeconds') ~ '^[0-9]{1,5}$'
 and (timer_config->>'workSeconds') ~ '^[0-9]{1,4}$'
 and (timer_config->>'restSeconds') ~ '^[0-9]{1,4}$'
 and (timer_config->>'rounds') ~ '^[0-9]{1,3}$'
 and (timer_config->>'durationSeconds')::numeric between 1 and 10800
 and (timer_config->>'workSeconds')::numeric between 1 and 3600
 and (timer_config->>'restSeconds')::numeric between 0 and 3600
 and (timer_config->>'rounds')::numeric between 1 and 100
 and case timer_config->>'mode'
 when 'interval' then ((timer_config->>'workSeconds')::numeric+(timer_config->>'restSeconds')::numeric)*(timer_config->>'rounds')::numeric
 when 'emom' then 60*(timer_config->>'rounds')::numeric
 else (timer_config->>'durationSeconds')::numeric end <= 10800
 ),false)
);

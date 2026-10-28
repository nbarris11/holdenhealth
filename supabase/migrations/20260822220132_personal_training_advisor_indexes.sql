-- Support foreign-key lookups and cleanup without scanning the training tables.
create index scheduled_workouts_created_by_idx
  on public.scheduled_workouts (created_by);

create index week_resets_member_id_idx
  on public.week_resets (member_id);

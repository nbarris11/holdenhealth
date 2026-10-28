-- Preserve the exact OR semantics while avoiding duplicate permissive policy evaluation.
do $$
declare item record; base_policy record; extra_policy record; clause text;
begin
 for item in select * from (values
  ('challenge_workouts','workout_read','personal_workout_read'),
  ('challenge_workout_logs','workout_log_read','personal_workout_log_read'),
  ('challenge_workout_logs','workout_log_insert','personal_workout_log_insert'),
  ('class_habit_weeks','class_habit_weeks_read','personal_habit_week_read'),
  ('class_habit_weeks','class_habit_weeks_insert','personal_habit_week_insert'),
  ('class_habit_marks','class_habit_marks_read','personal_habit_marks_read'),
  ('class_habit_marks','class_habit_marks_insert','personal_habit_marks_insert'),
  ('class_habit_marks','class_habit_marks_delete','personal_habit_marks_delete')
 ) as policies(table_name,base_name,extra_name) loop
  select * into base_policy from pg_policies where schemaname='public' and tablename=item.table_name and policyname=item.base_name;
  select * into extra_policy from pg_policies where schemaname='public' and tablename=item.table_name and policyname=item.extra_name;
  if base_policy.roles is distinct from extra_policy.roles or base_policy.cmd is distinct from extra_policy.cmd or base_policy.policyname is null or extra_policy.policyname is null then raise exception 'Policy mismatch'; end if;
  if base_policy.cmd='INSERT' then clause:=format('WITH CHECK ((%s) OR (%s))',base_policy.with_check,extra_policy.with_check);
  else clause:=format('USING ((%s) OR (%s))',base_policy.qual,extra_policy.qual); end if;
  execute format('ALTER POLICY %I ON public.%I %s',item.base_name,item.table_name,clause);
  execute format('DROP POLICY %I ON public.%I',item.extra_name,item.table_name);
 end loop;
end $$;

-- NULL requested_by identifies a scheduled request; manual admin policy is retained.
alter table public.program_review_requests alter column requested_by drop not null;

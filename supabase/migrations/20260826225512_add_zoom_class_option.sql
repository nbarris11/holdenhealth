alter table public.class_meetings
  add column if not exists is_zoom boolean not null default false;

comment on column public.class_meetings.is_zoom is
  'True when this class is held online through Zoom instead of in person.';

alter table public.profiles
add column if not exists provider text not null default 'email';

comment on column public.profiles.provider is
  'Authentication provider label used by older auth/profile flows. Defaults to email.';

notify pgrst, 'reload schema';

-- Anonymous users have a real auth.users UUID but no email until they
-- deliberately link one. Preserve every existing profile and its email.
-- Apply ONLY after isolated-staging QA, before GUEST_AUTH_ENABLED=true.
alter table public.profiles
  alter column email drop not null;

comment on column public.profiles.email is
  'NULL for an unlinked anonymous guest; never use this mutable field as proof of verified identity.';

-- Existing RLS profiles_insert_own / profiles_select_own / profiles_update_own
-- continue to require auth.uid() = id. For paid operations the Worker separately
-- verifies non-anonymous Supabase Auth identity, not public.profiles.email.

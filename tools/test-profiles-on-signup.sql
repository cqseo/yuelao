-- Isolated ephemeral PostgreSQL integration test; never run on a hosted database.
do $$
declare n int; e text;
begin
  insert into auth.users(id, email) values ('00000000-0000-4000-8000-0000000000d1', 'New@Example.invalid');
  select email into e from public.profiles where id = '00000000-0000-4000-8000-0000000000d1';
  if e is distinct from 'new@example.invalid' then raise exception 'signup did not create profile: %', e; end if;
  raise notice 'PASS: a new user with email gets a profile (email lower-cased)';

  insert into auth.users(id, email) values ('00000000-0000-4000-8000-0000000000d2', null);
  select count(*) into n from public.profiles where id = '00000000-0000-4000-8000-0000000000d2';
  if n <> 0 then raise exception 'profile created without email'; end if;
  raise notice 'PASS: a user without email is created without a profile and without error';

  update auth.users set email = 'later@example.invalid' where id = '00000000-0000-4000-8000-0000000000d2';
  select count(*) into n from public.profiles where id = '00000000-0000-4000-8000-0000000000d2';
  if n <> 1 then raise exception 'profile not created when email added'; end if;
  raise notice 'PASS: adding an email later creates the profile';

  update auth.users set email = 'changed@example.invalid' where id = '00000000-0000-4000-8000-0000000000d1';
  select email into e from public.profiles where id = '00000000-0000-4000-8000-0000000000d1';
  if e <> 'changed@example.invalid' then raise exception 'email change not synced'; end if;
  raise notice 'PASS: an email change is copied to the profile';

  -- 讓 profiles 寫入失敗：註冊本身仍要成功
  alter table public.profiles add constraint t_block check (email <> 'blocked@example.invalid');
  insert into auth.users(id, email) values ('00000000-0000-4000-8000-0000000000d3', 'blocked@example.invalid');
  alter table public.profiles drop constraint t_block;
  select count(*) into n from auth.users where id = '00000000-0000-4000-8000-0000000000d3';
  if n <> 1 then raise exception 'signup failed because profile insert failed'; end if;
  raise notice 'PASS: a failing profile insert never blocks signup';

  if has_function_privilege('anon', 'public.ensure_profile_for_user()', 'execute')
     or has_function_privilege('authenticated', 'public.ensure_profile_for_user()', 'execute') then
    raise exception 'client roles can call the trigger function';
  end if;
  raise notice 'PASS: client roles cannot call the trigger function';
end;
$$;

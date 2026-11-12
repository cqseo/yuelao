-- 註冊即建 profiles：Supabase Auth 新增使用者時，自動補一列 public.profiles。
--
-- 之前沒有任何地方建 profiles，登入後的許願、下單都會因為找不到 profile 而失敗。
-- profiles.email 是 NOT NULL，所以只在有 email 時建（之後補上 email 的帳號，在 email 更新時補建）。
-- 觸發器絕不讓 Auth 的註冊失敗：任何錯誤都吞掉，只記一行警告。
-- 只做加法：既有資料不動；同時替已存在、還沒有 profile 的帳號補建（目前線上 auth.users 為 0）。

create or replace function public.ensure_profile_for_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is not null and new.email <> '' then
    insert into public.profiles (id, email)
    values (new.id, lower(new.email))
    on conflict (id) do update set email = excluded.email, updated_at = now()
      where public.profiles.email is distinct from excluded.email;
  end if;
  return new;
exception when others then
  raise warning 'ensure_profile_for_user failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;

revoke all on function public.ensure_profile_for_user() from public, anon, authenticated;

drop trigger if exists ensure_profile_on_signup on auth.users;
create trigger ensure_profile_on_signup
  after insert or update of email on auth.users
  for each row execute function public.ensure_profile_for_user();

insert into public.profiles (id, email)
select u.id, lower(u.email) from auth.users u
where u.email is not null and u.email <> ''
on conflict (id) do nothing;

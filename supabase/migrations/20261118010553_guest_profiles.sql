-- 訪客帳號（站長 2026-11-18：沒登入也能付款）。
-- 沒登入的人按「解鎖」時，Worker 用 Supabase 匿名登入建一個訪客帳號；買到的東西記在這個帳號上，
-- 之後他綁信箱時是「改這個帳號的信箱」，帳號 ID 不變，訂單與解讀都跟著走。
--
-- 1. profiles.email 允許空值：訪客還沒有信箱。既有資料完全不動。
-- 2. 註冊觸發器：匿名使用者新增時也建一列 profile（email 為空）；綁信箱（auth.users.email 更新）時
--    原本的分支會把信箱補上。觸發器照舊吞掉錯誤，絕不讓 Auth 註冊失敗。
-- profiles.email 只拿來顯示，從來不當身分證明；誰能動哪筆資料一律看 auth.users 的 id。

alter table public.profiles
  alter column email drop not null;

comment on column public.profiles.email is
  'NULL while the account is a guest (anonymous) without an email. Display only; never proof of identity.';

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
  elsif tg_op = 'INSERT' and coalesce(new.is_anonymous, false) then
    insert into public.profiles (id, email)
    values (new.id, null)
    on conflict (id) do nothing;
  end if;
  return new;
exception when others then
  raise warning 'ensure_profile_for_user failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;

revoke all on function public.ensure_profile_for_user() from public, anon, authenticated;

-- 修 20261121130000_merit_board.sql 的 merit_board：總人數放在 CTE 外面算會找不到 totals。
-- 改成在同一個查詢裡一起算出來。只換函數本體，權限不變。

create or replace function public.merit_board(p_range text, p_device_hash text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_from date;
  v_top jsonb;
  v_me jsonb;
  v_players integer;
begin
  v_from := case p_range
    when 'day' then public.merit_today()
    when 'week' then public.merit_today() - 6
    when 'all' then date '2000-01-01'
    else null end;
  if v_from is null then
    return jsonb_build_object('error', 'invalid');
  end if;

  with totals as (
    select s.device_hash, sum(s.count)::integer as total, max(s.updated_at) as last_at
      from public.merit_scores s
      join public.merit_players p on p.device_hash = s.device_hash and not p.hidden
     where s.day >= v_from
     group by s.device_hash
    having sum(s.count) > 0
  ), ranked as (
    select t.*, rank() over (order by t.total desc) as rnk,
           row_number() over (order by t.total desc, t.last_at asc) as rn
      from totals t
  )
  select
    coalesce((select jsonb_agg(jsonb_build_object('rank', r.rnk, 'nickname', p.nickname, 'total', r.total,
                                                  'me', r.device_hash = p_device_hash) order by r.rn)
                from ranked r join public.merit_players p using (device_hash)
               where r.rn <= 50), '[]'::jsonb),
    (select jsonb_build_object('rank', r.rnk, 'total', r.total)
       from ranked r where r.device_hash = p_device_hash),
    (select count(*)::integer from ranked)
    into v_top, v_me, v_players;

  return jsonb_build_object('top', v_top, 'me', v_me, 'players', v_players, 'day', public.merit_today());
end;
$$;

revoke all on function public.merit_board(text, text) from public, anon, authenticated;
grant execute on function public.merit_board(text, text) to service_role;

-- Executed only in a disposable PostgreSQL database, never production.
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.profiles(id,email) values ('00000000-0000-4000-8000-000000000001','qa@example.invalid') on conflict do nothing;
insert into public.sticks(id,no,grade,level,knot,knot_name,poem,verdict_him,verdict_single,verdict_reunion)
values
 (1,'第一籤','中平籤',2,'tongxin','同心結','測試詩之一','測試話','測試話','測試話'),
 (2,'第二籤','上籤',4,'tongxin','同心結','測試詩之二','測試話','測試話','測試話') on conflict do nothing;

do $$
declare
 u uuid := '00000000-0000-4000-8000-000000000001';
 r jsonb;
 uid uuid;
 claim uuid;
 body text := repeat('這份報告提醒我們尊重彼此的意願，從具體行動出發，並不預測對方會如何選擇。',5);
 count_rows int;
 pack uuid;
 ans uuid;
begin
 select public.claim_paid_ai_reading(u,1::smallint,'him','zh-Hant') into r;
 if r->>'state' <> 'not_unlocked' then raise exception 'no entitlement should fail'; end if;
 raise notice 'PASS: claim blocked without entitlement';

 insert into public.unlocks(user_id,stick_id,category,locale,source)
 values (u,1::smallint,'him','zh-Hant','order') returning id into uid;
 select public.claim_paid_ai_reading(u,1::smallint,'him','zh-Hant') into r;
 if r->>'state'<>'claimed' then raise exception 'expected claim: %',r; end if;
 claim := (r->>'claimId')::uuid;
 select public.claim_paid_ai_reading(u,1::smallint,'him','zh-Hant') into r;
 if r->>'state'<>'processing' then raise exception 'second claim should be processing: %',r; end if;
 raise notice 'PASS: concurrent generation claim serialized';

 if public.finish_paid_ai_reading(u,uid,gen_random_uuid(),body,'model-qa') then
   raise exception 'wrong claim should not finalize';
 end if;
 if not public.finish_paid_ai_reading(u,uid,claim,body,'model-qa') then
   raise exception 'correct claim did not finalize';
 end if;
 if public.finish_paid_ai_reading(u,uid,claim,body,'model-qa') then
   raise exception 'duplicate finalization was accepted';
 end if;
 select public.claim_paid_ai_reading(u,1::smallint,'him','zh-Hant') into r;
 if r->>'state'<>'ready' then raise exception 'completed claim should be ready'; end if;
 if public.get_paid_ai_reading(u,1::smallint,'him','zh-Hant') <> body then
   raise exception 'cannot read completed own content';
 end if;
 if public.get_paid_ai_reading('00000000-0000-4000-8000-000000000002'::uuid,1::smallint,'him','zh-Hant') is not null then
   raise exception 'other user could read paid report';
 end if;
 raise notice 'PASS: finalization once, ownership and ready replay';

 update public.unlocks set revoked=true where id=uid;
 if public.get_paid_ai_reading(u,1::smallint,'him','zh-Hant') is not null then
   raise exception 'revoked reader can still access paid report';
 end if;
 select public.claim_paid_ai_reading(u,1::smallint,'him','zh-Hant') into r;
 if r->>'state'<>'not_unlocked' then raise exception 'revoked reader could claim'; end if;
 raise notice 'PASS: refunded/revoked entitlement cannot read or regenerate';

 insert into public.entitlements(user_id,product_id,total_uses)
 values (u,'pack_3',3) returning id into pack;
 select public.consume_pack_use(u,pack,2::smallint,'single','zh-Hant') into ans;
 if ans is null then raise exception 'first pack redemption failed'; end if;
 if public.consume_pack_use(u,pack,2::smallint,'single','zh-Hant') is distinct from ans then
   raise exception 'idempotent repeat got different unlock';
 end if;
 if (select used_uses from public.entitlements where id=pack) <> 1 then
   raise exception 'repeat redemption double spent pack use';
 end if;
 raise notice 'PASS: duplicate redemption does not double spend';

 if has_function_privilege('anon','public.claim_paid_ai_reading(uuid,smallint,text,text)','EXECUTE') then
   raise exception 'anon can claim generated reading';
 end if;
 if has_function_privilege('authenticated','public.get_paid_ai_reading(uuid,smallint,text,text)','EXECUTE') then
   raise exception 'authenticated can bypass server reading check';
 end if;
 raise notice 'PASS: RPC grants limited to service role';
end;
$$;

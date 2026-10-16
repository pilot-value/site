-- 生成物。手で直さない。直すのは台帳（living-facts.mjs ほか）→ node gen-towns.mjs
-- 貼る順: db/towns.sql → **このファイル** → db/contrib.sql
do $$
begin
  if to_regclass('public.pv_towns') is null or to_regprocedure('public.pv_town_key(text)') is null then
    raise exception '先に db/towns.sql を実行してください（pv_towns / pv_town_key が無い）';
  end if;
end $$;

-- 1. 台帳の街（会社ページのカードの名前）
insert into public.pv_towns (airline, base_iata, tkey, name, origin, state, moderated_at)
select v.airline, v.base, public.pv_town_key(v.name), v.name, 'ledger', 'public', now()
  from (values
    ('jal', 'HND', '品川'),
    ('jal', 'HND', '豊洲'),
    ('jal', 'HND', '横浜'),
    ('ana', 'HND', '品川'),
    ('ana', 'HND', '豊洲'),
    ('ana', 'HND', '横浜'),
    ('cathay-pacific', 'HKG', '東涌'),
    ('cathay-pacific', 'HKG', '愉景灣'),
    ('cathay-pacific', 'HKG', '青衣'),
    ('etihad', 'AUH', 'ハリファ・シティ'),
    ('etihad', 'AUH', 'アル・リーム島'),
    ('etihad', 'AUH', 'アル・ラハ・ビーチ'),
    ('etihad', 'AUH', 'ヤス島'),
    ('eva-air', 'TPE', '南崁'),
    ('eva-air', 'TPE', '青埔'),
    ('eva-air', 'TPE', '林口')
  ) as v(airline, base, name)
on conflict (airline, base_iata, tkey) do update set
  name = excluded.name, origin = 'ledger', state = 'public', alias_of = null,
  moderated_at = coalesce(public.pv_towns.moderated_at, excluded.moderated_at);

-- 2. 同じ街の別の書き方（カードがラテン文字で添えている表記）。打った時点で、その街に入る。
--    ★台帳の街そのものは、別の書き方に変えない（where の条件。鍵がぶつかったら、街のほうを残す）。
insert into public.pv_towns (airline, base_iata, tkey, name, origin, state, alias_of, moderated_at)
select v.airline, v.base, public.pv_town_key(v.alias), v.alias, 'ledger', 'public', t.id, now()
  from (values
    ('cathay-pacific', 'HKG', '東涌', 'Tung Chung'),
    ('cathay-pacific', 'HKG', '愉景灣', 'Discovery Bay'),
    ('cathay-pacific', 'HKG', '青衣', 'Tsing Yi'),
    ('etihad', 'AUH', 'ハリファ・シティ', 'Khalifa City'),
    ('etihad', 'AUH', 'アル・リーム島', 'Al Reem Island'),
    ('etihad', 'AUH', 'アル・ラハ・ビーチ', 'Al Raha Beach'),
    ('etihad', 'AUH', 'ヤス島', 'Yas Island')
  ) as v(airline, base, name, alias)
  join public.pv_towns t
    on t.airline = v.airline and t.base_iata = v.base and t.tkey = public.pv_town_key(v.name) and t.alias_of is null
 where public.pv_town_key(v.alias) is not null and public.pv_town_key(v.alias) <> t.tkey
on conflict (airline, base_iata, tkey) do update set
  name = excluded.name, origin = 'ledger', state = 'public', alias_of = excluded.alias_of,
  moderated_at = coalesce(public.pv_towns.moderated_at, excluded.moderated_at)
  where not (public.pv_towns.origin = 'ledger' and public.pv_towns.alias_of is null);

-- 3. 別の書き方の行に付いていた投稿を、街の行へ移す（先に会員がその書き方で出していた場合。
--    同じ人が両方に出していたら、街の行のほうを残す）。何度流しても同じ。
delete from public.pv_town_posts s
 using public.pv_towns a, public.pv_town_posts d
 where s.town_id = a.id and a.alias_of is not null
   and d.town_id = a.alias_of and d.author_hash = s.author_hash;
update public.pv_town_posts s
   set town_id = a.alias_of
  from public.pv_towns a
 where s.town_id = a.id and a.alias_of is not null;

-- 検算：台帳の街と、別の書き方の数（会社・基地ごと）
select t.airline, t.base_iata,
       count(*) filter (where t.origin = 'ledger' and t.alias_of is null)     as 台帳の街,
       count(*) filter (where t.origin = 'ledger' and t.alias_of is not null) as 別の書き方
  from public.pv_towns t group by 1, 2 order by 1, 2;

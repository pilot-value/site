-- ══════════════════════════════════════════════════════════════
-- run-05-review-i18n.sql — 口コミの日↔英 自動翻訳のためのDDL＋既存6件の英訳
--
-- db/schema-additions.sql のセクション5と同じ内容を、SQL Editor に
-- そのまま貼れるよう切り出したもの。全選択してコピー→Run で完了。
-- 冪等（何度流しても既存の訳は上書きしない）。
-- ══════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- ── 5) 口コミの日↔英 自動翻訳（reviews_v2）──
-- 日本語で投稿された口コミが英語ページにそのまま出ていた問題への対応。
-- orig_lang … 投稿原文の言語（'ja' | 'en'）
-- translations … 反対言語の訳文。形は {"en":{"culture":…,"salary":…,
--   "benefits":…,"wlb":…,"ops":…,"training":…,"mgmt":…}}（原文が en なら "ja"）。
--   欄が空の口コミはキー自体を入れない。表示側は translations が無い/空でも
--   原文表示にフォールバックするので、この SQL 未適用でもサイトは壊れない。
-- 冪等（何度流しても安全）。
-- ════════════════════════════════════════════════════════════════
alter table public.reviews_v2
  add column if not exists orig_lang    text not null default 'ja',
  add column if not exists translations jsonb;

comment on column public.reviews_v2.orig_lang    is '投稿原文の言語 ja|en';
comment on column public.reviews_v2.translations is '反対言語の訳文 {"en":{...}} または {"ja":{...}}';

-- 未翻訳の行だけを拾うための部分インデックス（Edge Function の再処理用）
create index if not exists reviews_v2_untranslated_idx
  on public.reviews_v2 (created_at) where translations is null;


-- ── 既存6件のバックフィル ──
-- Edge Function を用意する前に投稿された分。原文の意味を変えない忠実訳で、
-- 意訳・要約・脚色はしていない（1件も削っていない。空欄はキーごと省略）。
-- where に translations is null を付けているので、
-- 何度流しても既に入っている訳を上書きしない。
update public.reviews_v2
   set orig_lang = 'ja',
       translations = $j${"en":{"culture":"There is a sense of distance between the company and the crew, but the training and the operation itself are of high quality.","salary":"The pay is attractive and I have no complaints.","benefits":"One of the attractions is the staff travel tickets, which can be used for family members as well, on both domestic and international flights. That said, on international flights you can end up waiting for an open seat, so there are few chances to actually use them when taking a long break.","wlb":"Duty periods are long, and I often feel the fatigue even during the time I spend with my family on days off.","ops":"Safety standards are very high, but there is no denying that some pilots are characters who operate in their own particular way.","training":"High quality, and I have no complaints. Most of it is carried out during daytime hours, so the physical strain is also light."}}$j$::jsonb
 where id = '1920cde4-325a-4629-8979-726a51bd2a93' and translations is null;

update public.reviews_v2
   set orig_lang = 'ja',
       translations = $j${"en":{"culture":"Inside, it is still a Showa-era Japanese conglomerate stuck in its old ways. Very much a hierarchical, athletic-club culture. A culture that is fairly hard going for the Reiwa generation.","salary":"It has not kept up with inflation at all.\nWe used to have the number-one pay among Japanese airlines, but lately other carriers have kept raising theirs in order to stop talent from leaving, so our pay no longer has any advantage.","benefits":"Good overall.","wlb":"Good overall.","ops":"Discrepancies with the dispatcher do arise, but the principle that final authority rests with the captain is respected.","mgmt":"If you are going to call yourselves a leading airline, then lead on pilot pay levels as well.\nOtherwise the outflow of talent will become impossible to stop."}}$j$::jsonb
 where id = '9f19c930-fbb9-48ab-b004-e2a6b2f78309' and translations is null;

update public.reviews_v2
   set orig_lang = 'ja',
       translations = $j${"en":{"culture":"I think it has become considerably easier to work here than it used to be, but even so there is nothing but room for improvement.","salary":"I cannot say it is very good.","benefits":"There is a housing allowance, but it amounts to a pittance.","wlb":"Duty periods are a little under 9–12 hours every day. For some people they are longer. If you have a duty-officer shift, a flight follows straight after the shift ends, so you are on duty for 36 hours.\nBasically you are doing flight duties and ground duties continuously, so even if a flight finishes in the early afternoon, ground duties follow and you never get to go home.","ops":"Not good, the aircraft and the environment included.","training":"There is not much in the way of support."}}$j$::jsonb
 where id = 'fb3ddffa-a5ab-4553-84cd-84b7e8551fd6' and translations is null;

update public.reviews_v2
   set orig_lang = 'ja',
       translations = $j${"en":{"culture":"It is rigid.\nMany people are fed up with the fact that governance is not working.\nThe company cannot get out from under its alcohol problem.","salary":"The pay is so-so.","benefits":"Considerably inferior compared with ANA.","wlb":"There is a lot that is tough.\nYou can take days off without any trouble.\nAs long as it falls within the regulations, you get assigned punishing rosters right up to the limit.","ops":"Time pressure is heavy.\nAwareness differs too much between departments, and the organization has become siloed.","training":"It is properly run, but demanding.\nI would not recommend it if you want to be promoted quickly."}}$j$::jsonb
 where id = 'e6c70426-06de-44a3-b2b6-c667df6eb8e5' and translations is null;

update public.reviews_v2
   set orig_lang = 'ja',
       translations = $j${"en":{"culture":"When it comes to safety culture, it is extremely strict. That said, there is a tendency to become bound by rules and procedures beyond what the actual situation warrants (bureaucratic), and voices from the front line sometimes suggest that a somewhat more flexible operation would be acceptable.","salary":"Base pay and allowances were cut heavily at the time of the bankruptcy in the past, but following the subsequent recovery in performance and the recent moves to address inflation and to invest in people, they have now been corrected to a level befitting the top of the industry.","benefits":"The staff travel scheme on JAL and partner flights, which makes the most of oneworld membership, is extremely strong. It contributes a great deal to time spent with family and to enriching my own private life."}}$j$::jsonb
 where id = '1bef802d-755c-4193-8dfe-840e1d71c31e' and translations is null;

update public.reviews_v2
   set orig_lang = 'ja',
       translations = $j${"en":{"benefits":"Because we are based at Haneda Airport, we operate within an extremely congested schedule. Maintaining on-time performance while staying conscious of fuel efficiency (eco-flight) and at the same time guaranteeing safety — the advanced management ability demanded of a captain is tested on every single flight.","wlb":"Because we are based at Haneda Airport, we operate within an extremely congested schedule. Maintaining on-time performance while staying conscious of fuel efficiency (eco-flight) and at the same time guaranteeing safety — the advanced management ability demanded of a captain is tested on every single flight.","ops":"Because we are based at Haneda Airport, we operate within an extremely congested schedule. Maintaining on-time performance while staying conscious of fuel efficiency (eco-flight) and at the same time guaranteeing safety — the advanced management ability demanded of a captain is tested on every single flight."}}$j$::jsonb
 where id = 'b95b3841-5db9-4d77-96bc-a8a0aad53b3b' and translations is null;

-- 確認用（使うときは下の4行から -- を「まとめて」外す。1行だけ外すと
-- 文が途中で終わって 42601 syntax error at end of input になる）:
-- select id, airline, orig_lang,
--        translations->'en'->>'culture' as culture_en,
--        translations is null as untranslated
--   from public.reviews_v2 order by created_at desc;

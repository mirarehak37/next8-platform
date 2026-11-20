-- ============================================================================
-- NEXT8 CRM ← aplikace (Supabase): výdej dat uživatelů pro CRM
--
-- Spusťte jednou v Supabase → SQL Editor (běží pod postgres). Skript je
-- idempotentní, při změně pravidel ho stačí spustit znovu.
--
-- Co vytvoří:
--   • schéma crm a funkci crm.export_users(): jeden řádek na uživatele,
--     stejné sloupce jako ruční export do CRM. ŽÁDNÁ zdravotní data
--     (logy, zranění, váha, výška, tep) — jen počty aktivních dní.
--   • roli crm_reader, která smí JEN zavolat tuto funkci. Do tabulek
--     aplikace (ani auth.users) přímý přístup nemá.
--
-- Heslo role: nejjednodušeji přes průvodce scripts/supabase/napojeni.sh, který ho
-- vygeneruje a dosadí. Ručně: nahraďte ZMENTE-HESLO níže dlouhým náhodným heslem.
-- ============================================================================

create schema if not exists crm;

create or replace function crm.export_users()
returns table (
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  nickname text,
  registered_at date,
  registered_via text,
  platform text,
  account_type text,
  plan text,
  payment_via text,
  subscription_until date,
  role text,
  teams text,
  activity text,
  last_activity date,
  active_days_7 int,
  active_days_30 int,
  active_days_total int,
  marketing_consent text,
  consent_source text,
  commercial_ok text,
  push text,
  morning_reminder text,
  evening_reminder text,
  gender text,
  age_category text,
  "position" text,
  cohort text,
  codes text
)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  with today as (
    select (now() at time zone 'Europe/Prague')::date as d
  ),
  -- Kohorty = registrační okna kampaní. Novou kohortu přidejte řádkem sem.
  cohorts(name, od, "do") as (
    values
      ('Shooters kemp 07/2026', date '2026-07-13', date '2026-07-19'),
      ('Reel Macháček 10/2026', date '2026-10-08', date '2026-10-14'),
      ('Onboarding sekvence 11/2026', date '2026-11-18', date '2099-12-31')
  ),
  days as (
    select user_id, date from public.daily_logs
    union select user_id, date from public.training_sessions
    union select user_id, date from public.food_logs
    union select user_id, date from public.habit_entries where done is not null
  ),
  activity as (
    select
      d.user_id,
      count(*) filter (where d.date >= t.d - 6) as a7,
      count(*) filter (where d.date >= t.d - 29) as a30,
      count(*) as total,
      max(d.date) as last_day
    from days d cross join today t
    where d.date <= t.d
    group by d.user_id
  ),
  membership as (
    select
      tm.user_id,
      string_agg(distinct t.name, ', ' order by t.name) as teams,
      bool_or(tm.role in ('coach', 'manager', 'assistant', 'physio')) as is_coach
    from public.team_members tm
    join public.teams t on t.id = tm.team_id
    group by tm.user_id
  ),
  sub as (
    select distinct on (s.user_id) s.user_id, s.source, s.plan_key, s.expires_at
    from public.subscriptions s
    where s.active and s.tier = 'pro' and (s.expires_at is null or s.expires_at > now())
    order by s.user_id, s.updated_at desc
  ),
  codes as (
    select pr.user_id, string_agg(pr.code, ', ' order by pr.redeemed_at) as codes
    from public.promo_redemptions pr
    group by pr.user_id
  ),
  base as (
    select
      p.id,
      coalesce(p.email, u.email) as email,
      p.first_name,
      p.last_name,
      p.name,
      coalesce(nullif(p.display_name, ''), nullif(p.username, '')) as nickname,
      (p.created_at at time zone 'Europe/Prague')::date as registered_at,
      coalesce(u.raw_app_meta_data ->> 'provider', 'email') as provider,
      p.onboarding_completed,
      p.marketing_consent,
      p.marketing_consent_at,
      p.marketing_consent_source,
      p.sex,
      coalesce(extract(year from age(p.date_of_birth))::int, p.age) as years,
      p."position" as pos,
      ns.platform,
      (ns.push_token is not null or ns.push_subscription is not null) as has_push,
      ns.morning_enabled,
      ns.evening_enabled
    from public.profiles p
    left join auth.users u on u.id = p.id
    left join public.notification_settings ns on ns.user_id = p.id
    where coalesce(p.email, u.email) is not null
      and coalesce(p.email, u.email) not like '%@demo.next8.invalid'
  ),
  consent as (
    select
      b.id,
      case
        when b.marketing_consent is true and b.marketing_consent_source in ('terms_update', 'prompt', 'settings') then 'ano'
        when b.marketing_consent is false and b.marketing_consent_at is not null then 'ne'
        else 'nerozhodnuto'
      end as state
    from base b
  )
  select
    b.id as user_id,
    b.email,
    coalesce(nullif(b.first_name, ''), split_part(coalesce(b.name, ''), ' ', 1)) as first_name,
    coalesce(nullif(b.last_name, ''), nullif(regexp_replace(coalesce(b.name, ''), '^\S+\s*', ''), '')) as last_name,
    b.nickname,
    b.registered_at,
    case b.provider when 'google' then 'Google' when 'apple' then 'Apple' else 'E-mail' end as registered_via,
    case lower(coalesce(b.platform, '')) when 'ios' then 'iOS' when 'android' then 'Android' when 'web' then 'Web' when '' then null else b.platform end as platform,
    case
      when s.user_id is null then case when m.user_id is not null then 'Free v týmu' else 'Free sám' end
      when s.source in ('team', 'club') then 'PRO přes tým'
      when s.source in ('system', 'manual') then 'PRO – přiděleno ručně'
      when s.source = 'promo' then 'PRO – promo kód'
      when s.plan_key like 'team%' then 'Trenér – koupil týmový plán'
      else 'PRO – koupil sám'
    end as account_type,
    s.plan_key as plan,
    s.source as payment_via,
    (s.expires_at at time zone 'Europe/Prague')::date as subscription_until,
    case when m.is_coach then 'Trenér' when m.user_id is not null then 'Hráč v týmu' else 'Jednotlivec' end as role,
    m.teams,
    case
      when b.onboarding_completed is not true then 'Nedokončil registraci'
      when coalesce(a.a30, 0) >= 20 then 'Denní'
      when coalesce(a.a30, 0) >= 8 then 'Pravidelný'
      when coalesce(a.a30, 0) >= 1 then 'Občasný'
      when a.last_day >= t.d - 90 then 'Spící (31–90 dní)'
      else 'Ztracený (90+ dní / nikdy)'
    end as activity,
    a.last_day as last_activity,
    coalesce(a.a7, 0)::int as active_days_7,
    coalesce(a.a30, 0)::int as active_days_30,
    coalesce(a.total, 0)::int as active_days_total,
    c.state as marketing_consent,
    b.marketing_consent_source as consent_source,
    case
      when c.state = 'ano' then 'ano'
      when c.state <> 'ne' and b.marketing_consent_source = 'signup_notice_optout' then 'ano'
      else 'ne'
    end as commercial_ok,
    case when b.has_push then 'ano' else 'ne' end as push,
    case when coalesce(b.morning_enabled, true) then 'ano' else 'ne' end as morning_reminder,
    case when coalesce(b.evening_enabled, true) then 'ano' else 'ne' end as evening_reminder,
    case b.sex when 'male' then 'muž' when 'female' then 'žena' end as gender,
    case
      when b.years is null then null
      when b.years <= 15 then 'do 15 let'
      when b.years <= 19 then '16–19 let'
      else '20+ let'
    end as age_category,
    case
      when lower(coalesce(b.pos, '')) in ('forward', 'attacker', 'utocnik', 'útočník', 'f') then 'Útočník'
      when lower(coalesce(b.pos, '')) in ('defender', 'defense', 'obrance', 'obránce', 'd') then 'Obránce'
      when lower(coalesce(b.pos, '')) in ('goalkeeper', 'goalie', 'brankar', 'brankář', 'g') then 'Brankář'
      when coalesce(b.pos, '') = '' then null
      else initcap(b.pos)
    end as "position",
    (select co.name from cohorts co where b.registered_at between co.od and co."do" limit 1) as cohort,
    cd.codes
  from base b
  cross join today t
  left join consent c on c.id = b.id
  left join activity a on a.user_id = b.id
  left join membership m on m.user_id = b.id
  left join sub s on s.user_id = b.id
  left join codes cd on cd.user_id = b.id
  order by b.registered_at desc;
$$;

revoke all on function crm.export_users() from public;

-- Role pro CRM: smí jen zavolat crm.export_users().
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'crm_reader') then
    create role crm_reader with noinherit;
  end if;
end
$$;

-- Heslo se nastaví při každém spuštění (opakované spuštění = nové heslo).
alter role crm_reader with login password 'ZMENTE_HESLO';

alter role crm_reader set statement_timeout = '60s';
grant usage on schema crm to crm_reader;
grant execute on function crm.export_users() to crm_reader;

-- Kontrola (spusťte zvlášť): select count(*), count(*) filter (where commercial_ok = 'ano') from crm.export_users();

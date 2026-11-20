import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { importAppUserRows, type ImportResult, type ImportRow } from "@/lib/contact-import";

// NEXT8 app (Supabase) → CRM. The CRM connects as the restricted role crm_reader
// (scripts/supabase/crm_export.sql) that can only call crm.export_users(): one row
// per app user, no health data. Each sync upserts contacts (tags, consent, custom
// fields — same rules as the manual "Uživatelé aplikace" import) and stores the
// day's counts for the app report.

export type AppUser = {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  registered_at: Date | null;
  registered_via: string | null;
  platform: string | null;
  account_type: string | null;
  plan: string | null;
  payment_via: string | null;
  subscription_until: Date | null;
  role: string | null;
  teams: string | null;
  activity: string | null;
  last_activity: Date | null;
  active_days_7: number | null;
  active_days_30: number | null;
  active_days_total: number | null;
  marketing_consent: string | null;
  consent_source: string | null;
  commercial_ok: string | null;
  push: string | null;
  morning_reminder: string | null;
  evening_reminder: string | null;
  gender: string | null;
  age_category: string | null;
  position: string | null;
  cohort: string | null;
  codes: string | null;
};

export type AppMetrics = {
  total: number;
  newLast7: number;
  newPrev7: number;
  newLast30: number;
  active7: number;
  active30: number;
  pro: number;
  commercialOk: number;
  pushOn: number;
  expiring30: number;
  byAccount: Record<string, number>;
  byActivity: Record<string, number>;
  byRole: Record<string, number>;
  byPlatform: Record<string, number>;
  byVia: Record<string, number>;
  byPayment: Record<string, number>;
  byAge: Record<string, number>;
  byGender: Record<string, number>;
  byConsent: Record<string, number>;
  byTeam: Record<string, number>;
  byCode: Record<string, number>;
  cohorts: { name: string; size: number; active7: number; active30: number; pro: number }[];
  registrationsByDay: Record<string, number>;
};

export const appSyncConfigured = () => !!process.env.APP_DB_URL;

const globalForApp = globalThis as unknown as { appDb?: PrismaClient };
function appDb() {
  if (!process.env.APP_DB_URL) throw new Error("Chybí proměnná APP_DB_URL (připojení k databázi aplikace).");
  globalForApp.appDb ??= new PrismaClient({ datasourceUrl: process.env.APP_DB_URL });
  return globalForApp.appDb;
}

export async function fetchAppUsers(): Promise<AppUser[]> {
  return appDb().$queryRawUnsafe<AppUser[]>("select * from crm.export_users()");
}

const ymd = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const s = (v: unknown) => (v == null ? "" : String(v));
const pragueToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(new Date());

// Same tag vocabulary as the app's manual export, so imports and syncs agree.
function tagsFor(u: AppUser) {
  const tags = [
    u.account_type && `Účet: ${u.account_type}`,
    u.role && `Role: ${u.role}`,
    u.activity && `Aktivita: ${u.activity}`,
    u.platform && `Platforma: ${u.platform}`,
    u.push === "ano" ? "Push zapnutý" : "Push vypnutý",
    u.age_category && `Věk: ${u.age_category}`,
    u.cohort && `Kohorta: ${u.cohort}`,
    u.position && `Pozice: ${u.position}`,
    u.marketing_consent && `Marketing souhlas: ${u.marketing_consent}`,
    ...s(u.codes).split(",").map((c) => c.trim()).filter(Boolean).map((c) => `Kód: ${c}`),
  ];
  return tags.filter(Boolean).join(", ");
}

export function toImportRow(u: AppUser): ImportRow {
  return {
    email: s(u.email),
    firstName: s(u.first_name),
    lastName: s(u.last_name),
    nickname: s(u.nickname),
    tags: tagsFor(u),
    app_registered_at: ymd(u.registered_at),
    app_registered_via: s(u.registered_via),
    app_platform: s(u.platform),
    app_account_type: s(u.account_type),
    app_plan: s(u.plan),
    app_payment_via: s(u.payment_via),
    app_subscription_until: ymd(u.subscription_until),
    app_role: s(u.role),
    app_teams: s(u.teams),
    app_activity: s(u.activity),
    app_last_activity: ymd(u.last_activity),
    app_active_days_7: s(u.active_days_7),
    app_active_days_30: s(u.active_days_30),
    app_active_days_total: s(u.active_days_total),
    app_marketing_consent: s(u.marketing_consent),
    app_consent_source: s(u.consent_source),
    app_commercial_ok: s(u.commercial_ok),
    app_push: s(u.push),
    app_morning_reminder: s(u.morning_reminder),
    app_evening_reminder: s(u.evening_reminder),
    app_gender: s(u.gender),
    app_age_category: s(u.age_category),
    app_position: s(u.position),
    app_cohort: s(u.cohort),
    app_codes: s(u.codes),
    app_user_id: s(u.user_id),
  };
}

function countBy(users: AppUser[], pick: (u: AppUser) => string | null | undefined) {
  const out: Record<string, number> = {};
  for (const u of users) {
    const k = pick(u) || "Neuvedeno";
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export function computeMetrics(users: AppUser[], today = pragueToday()): AppMetrics {
  const day = (offset: number) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - offset);
    return d.toISOString().slice(0, 10);
  };
  const reg = (u: AppUser) => ymd(u.registered_at);
  const isPro = (u: AppUser) => !!u.account_type && !u.account_type.startsWith("Free");
  const in30 = day(-30);

  const byTeam: Record<string, number> = {};
  const byCode: Record<string, number> = {};
  for (const u of users) {
    for (const t of s(u.teams).split(",").map((x) => x.trim()).filter(Boolean)) byTeam[t] = (byTeam[t] ?? 0) + 1;
    for (const c of s(u.codes).split(",").map((x) => x.trim()).filter(Boolean)) byCode[c] = (byCode[c] ?? 0) + 1;
  }

  const cohortNames = [...new Set(users.map((u) => u.cohort).filter((c): c is string => !!c))];
  const registrationsByDay: Record<string, number> = {};
  for (const u of users) {
    const d = reg(u);
    if (d) registrationsByDay[d] = (registrationsByDay[d] ?? 0) + 1;
  }

  return {
    total: users.length,
    newLast7: users.filter((u) => reg(u) > day(7)).length,
    newPrev7: users.filter((u) => reg(u) > day(14) && reg(u) <= day(7)).length,
    newLast30: users.filter((u) => reg(u) > day(30)).length,
    active7: users.filter((u) => (u.active_days_7 ?? 0) > 0).length,
    active30: users.filter((u) => (u.active_days_30 ?? 0) > 0).length,
    pro: users.filter(isPro).length,
    commercialOk: users.filter((u) => u.commercial_ok === "ano").length,
    pushOn: users.filter((u) => u.push === "ano").length,
    expiring30: users.filter((u) => u.subscription_until && ymd(u.subscription_until) >= today && ymd(u.subscription_until) <= in30).length,
    byAccount: countBy(users, (u) => u.account_type),
    byActivity: countBy(users, (u) => u.activity),
    byRole: countBy(users, (u) => u.role),
    byPlatform: countBy(users, (u) => u.platform),
    byVia: countBy(users, (u) => u.registered_via),
    byPayment: countBy(users.filter(isPro), (u) => u.payment_via),
    byAge: countBy(users, (u) => u.age_category),
    byGender: countBy(users, (u) => u.gender),
    byConsent: countBy(users, (u) => u.marketing_consent),
    byTeam,
    byCode,
    cohorts: cohortNames.map((name) => {
      const members = users.filter((u) => u.cohort === name);
      return {
        name,
        size: members.length,
        active7: members.filter((u) => (u.active_days_7 ?? 0) > 0).length,
        active30: members.filter((u) => (u.active_days_30 ?? 0) > 0).length,
        pro: members.filter(isPro).length,
      };
    }),
    registrationsByDay,
  };
}

// Tenant and record owner for unattended (cron) runs.
export async function resolveSyncContext() {
  const tenant = process.env.APP_SYNC_TENANT_ID
    ? await prisma.tenant.findUnique({ where: { id: process.env.APP_SYNC_TENANT_ID }, select: { id: true } })
    : await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!tenant) throw new Error("Nenašel jsem tenanta pro synchronizaci.");
  const ownerEmail = process.env.APP_SYNC_OWNER_EMAIL;
  const owner =
    (ownerEmail && (await prisma.user.findFirst({ where: { tenantId: tenant.id, email: ownerEmail }, select: { id: true } }))) ||
    (await prisma.user.findFirst({
      where: { tenantId: tenant.id, status: "active", userRoles: { some: { role: { name: "Administrator" } } } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }));
  if (!owner) throw new Error("Nenašel jsem administrátora, kterému by patřily synchronizované kontakty.");
  return { tenantId: tenant.id, ownerId: owner.id };
}

const CHUNK = 250;

export async function runAppSync(ctx: { tenantId: string; ownerId: string }, trigger: "cron" | "manual") {
  const run = await prisma.appSyncRun.create({ data: { tenantId: ctx.tenantId, trigger } });
  try {
    const users = (await fetchAppUsers()).filter((u) => u.email);
    const result: ImportResult = { created: 0, skipped: 0, linked: 0, errors: [] };
    const rows = users.map(toImportRow);
    for (let i = 0; i < rows.length; i += CHUNK) {
      const part: ImportResult = { created: 0, skipped: 0, errors: [] };
      await importAppUserRows({ id: ctx.ownerId, tenantId: ctx.tenantId }, rows.slice(i, i + CHUNK), part);
      result.created += part.created;
      result.skipped += part.skipped;
      result.linked! += part.linked ?? 0;
    }

    const today = pragueToday();
    const metrics = computeMetrics(users, today);
    await prisma.appMetricSnapshot.upsert({
      where: { tenantId_date: { tenantId: ctx.tenantId, date: new Date(`${today}T00:00:00Z`) } },
      create: { tenantId: ctx.tenantId, date: new Date(`${today}T00:00:00Z`), metrics },
      update: { metrics },
    });

    return await prisma.appSyncRun.update({
      where: { id: run.id },
      data: { status: "ok", finishedAt: new Date(), users: users.length, created: result.created, updated: result.linked ?? 0 },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.appSyncRun.update({ where: { id: run.id }, data: { status: "error", finishedAt: new Date(), error: message.slice(0, 1000) } });
    throw e;
  }
}

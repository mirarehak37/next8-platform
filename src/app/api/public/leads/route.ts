import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { onLeadCreated } from "@/lib/follow-ups";
import { ROLE_INTEREST } from "@/lib/web-form-intake";

// Leads from the forms on next8performance.cz. The website's own server function forwards each
// submission here (the token never reaches the browser):
//
//   POST /api/public/leads   header x-webhook-token: <WEB_LEAD_TOKEN>
//   { jmeno, email, telefon, klub, role, kategorie, pocet, termin, zprava, stranka, jazyk, zdroj, botcheck, utm_* }
//
// Env: WEB_LEAD_TOKEN (required). Optional WEB_LEAD_TENANT_ID / WEB_LEAD_OWNER_ID pick where leads
// land; without them the only tenant and its first active Administrator are used.

const ALLOWED_ORIGINS = ["https://next8performance.cz", "https://www.next8performance.cz"];
const MAX = 2000;

function cors(origin: string | null) {
  const h = new Headers({ "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, x-webhook-token", "Cache-Control": "no-store", Vary: "Origin" });
  if (origin && ALLOWED_ORIGINS.includes(origin)) h.set("Access-Control-Allow-Origin", origin);
  return h;
}

// Constant-time comparison so the token can't be guessed byte by byte from response timing.
function tokenOk(given: string | null, expected: string) {
  const a = createHash("sha256").update(given ?? "").digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).trim().slice(0, MAX) : "");

function roleKey(role: string) {
  const n = role.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (/tren|coach/.test(n)) return "coach";
  if (/rodic|parent/.test(n)) return "parent";
  if (/hrac|player/.test(n)) return "player";
  if (/klub|club|funkcion|oddil/.test(n)) return "club";
  return null;
}

async function target() {
  let tenantId = process.env.WEB_LEAD_TENANT_ID || null;
  if (!tenantId) {
    // Never guess between several tenants — that would put leads into the wrong company.
    const tenants = await prisma.tenant.findMany({ where: { status: "active" }, select: { id: true }, take: 2 });
    if (tenants.length !== 1) return null;
    tenantId = tenants[0].id;
  }
  let ownerId = process.env.WEB_LEAD_OWNER_ID || null;
  if (ownerId && !(await prisma.user.findFirst({ where: { id: ownerId, tenantId }, select: { id: true } }))) ownerId = null;
  if (!ownerId) {
    const owner =
      (await prisma.user.findFirst({ where: { tenantId, status: "active", userRoles: { some: { role: { name: "Administrator" } } } }, orderBy: { createdAt: "asc" }, select: { id: true } })) ??
      (await prisma.user.findFirst({ where: { tenantId, status: "active" }, orderBy: { createdAt: "asc" }, select: { id: true } }));
    ownerId = owner?.id ?? null;
  }
  return ownerId ? { tenantId, ownerId } : null;
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request.headers.get("origin")) });
}

export async function POST(request: Request) {
  const headers = cors(request.headers.get("origin"));
  const expected = process.env.WEB_LEAD_TOKEN;
  if (!expected) return Response.json({ ok: false, error: "endpoint_neni_nastaven" }, { status: 503, headers });
  if (!tokenOk(request.headers.get("x-webhook-token"), expected)) return Response.json({ ok: false, error: "neautorizovano" }, { status: 401, headers });

  let body: Record<string, unknown>;
  try {
    const type = request.headers.get("content-type") ?? "";
    body = type.includes("application/json") ? await request.json() : Object.fromEntries((await request.formData()).entries());
    if (!body || typeof body !== "object") throw new Error();
  } catch {
    return Response.json({ ok: false, error: "nevalidni_data" }, { status: 400, headers });
  }

  // Honeypot: the hidden field must stay empty.
  if (str(body.botcheck)) return Response.json({ ok: true, skipped: "bot" }, { headers });

  const email = str(body.email).toLowerCase();
  const phone = str(body.telefon) || str(body.phone);
  if (!email.includes("@") && !phone) return Response.json({ ok: false, error: "chybi_email" }, { status: 400, headers });

  const t = await target();
  if (!t) return Response.json({ ok: false, error: "nenastaven_tenant_nebo_vlastnik" }, { status: 500, headers });

  const fullName = str(body.jmeno) || str(body.name);
  const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);
  const role = str(body.role) || str(body.typ);
  const rk = roleKey(role);
  const page = str(body.stranka);
  const notes = [
    ["Zpráva", str(body.zprava) || str(body.message)],
    ["Kategorie", str(body.kategorie)],
    ["Počet hráčů", str(body.pocet)],
    ["Preferovaný termín", str(body.termin)],
    ["Stránka", page],
    ["Jazyk", str(body.jazyk)],
    ["UTM", [str(body.utm_source), str(body.utm_medium), str(body.utm_content)].filter(Boolean).join(" / ")],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  // The same person submitting again within a day: add to the existing lead instead of a duplicate.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = email.includes("@")
    ? await prisma.lead.findFirst({ where: { tenantId: t.tenantId, email, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, select: { id: true, notes: true } })
    : null;

  let leadId: string;
  if (recent) {
    await prisma.lead.update({
      where: { id: recent.id },
      data: { notes: [recent.notes, `--- Další odeslání z webu ${new Date().toLocaleString("cs-CZ", { timeZone: "Europe/Prague" })} ---`, notes].filter(Boolean).join("\n").slice(0, 10000) },
    });
    leadId = recent.id;
  } else {
    const lead = await prisma.lead.create({
      data: {
        tenantId: t.tenantId,
        ownerId: t.ownerId,
        firstName: firstName ?? (email.split("@")[0] || "Web"),
        lastName: rest.join(" ") || null,
        email: email.includes("@") ? email : null,
        phone: phone || null,
        companyName: str(body.klub) || null,
        jobTitle: role || null,
        productInterest: rk ? ROLE_INTEREST[rk] : null,
        source: "Web",
        campaign: str(body.zdroj) || str(body.utm_campaign) || null,
        status: "new",
        notes: notes || null,
      },
    });
    leadId = lead.id;
    // Same follow-up as any new lead: a "Zavolat" task for the owner (Administrace → Automatizace).
    await onLeadCreated(t.tenantId, lead, t.ownerId);
  }

  await prisma.auditLog.create({
    data: { tenantId: t.tenantId, entityType: "lead", entityId: leadId, action: recent ? "update" : "create", changes: JSON.stringify({ source: "web_form", stranka: page }) },
  });
  revalidatePath("/crm/leads");
  revalidatePath("/tasks");
  return Response.json({ ok: true, id: leadId, duplicate: Boolean(recent) }, { headers });
}

import { prisma } from "@/lib/prisma";

/**
 * Veřejný příjem leadů z webových formulářů (next8performance.cz).
 *
 * Autorizace hlavičkou `x-webhook-token`, která musí odpovídat proměnné
 * prostředí WEB_LEAD_TOKEN. Bez nastaveného tokenu endpoint nic nepřijímá.
 *
 * Proměnné prostředí:
 *   WEB_LEAD_TOKEN      povinné, sdílené tajemství s webem
 *   WEB_LEAD_TENANT_ID  nepovinné, když existuje jediný tenant, dohledá se sám
 *   WEB_LEAD_OWNER_ID   nepovinné, jinak se lead přiřadí nejstaršímu aktivnímu uživateli
 */

const ALLOWED_ORIGINS = [
  "https://next8performance.cz",
  "https://www.next8performance.cz",
];

const MAX_FIELD = 2000;

type Payload = Record<string, unknown>;

function corsHeaders(origin: string | null) {
  const h = new Headers({
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-webhook-token",
    "Cache-Control": "no-store",
    Vary: "Origin",
  });
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    h.set("Access-Control-Allow-Origin", origin);
  }
  return h;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_FIELD) : "";
}

/** "Martin Kadlec" -> ["Martin", "Kadlec"]; jedno slovo jde do příjmení. */
function splitName(full: string): [string | null, string | null] {
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return [null, null];
  if (parts.length === 1) return [null, parts[0]];
  return [parts.slice(0, -1).join(" "), parts[parts.length - 1]];
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

export async function POST(request: Request) {
  const headers = corsHeaders(request.headers.get("origin"));

  const expected = process.env.WEB_LEAD_TOKEN;
  if (!expected) {
    return Response.json({ ok: false, error: "endpoint_neni_nastaven" }, { status: 503, headers });
  }
  if (request.headers.get("x-webhook-token") !== expected) {
    return Response.json({ ok: false, error: "neautorizovano" }, { status: 401, headers });
  }

  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return Response.json({ ok: false, error: "nevalidni_json" }, { status: 400, headers });
  }

  // Past na roboty: skryté pole musí zůstat prázdné.
  if (text(body.botcheck)) return Response.json({ ok: true, skipped: "bot" }, { headers });

  const email = text(body.email).toLowerCase();
  if (!email || !email.includes("@")) {
    return Response.json({ ok: false, error: "chybi_email" }, { status: 400, headers });
  }

  const tenantId =
    process.env.WEB_LEAD_TENANT_ID ??
    (await prisma.tenant.findFirst({ where: { status: "active" }, orderBy: { createdAt: "asc" } }))?.id;
  if (!tenantId) {
    return Response.json({ ok: false, error: "tenant_nenalezen" }, { status: 500, headers });
  }

  const ownerId =
    process.env.WEB_LEAD_OWNER_ID ??
    (
      await prisma.user.findFirst({
        where: { tenantId, status: "active" },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })
    )?.id;
  if (!ownerId) {
    return Response.json({ ok: false, error: "vlastnik_nenalezen" }, { status: 500, headers });
  }

  const [firstName, lastName] = splitName(text(body.jmeno) || text(body.name));

  // Poznámka drží to, co se do modelu Lead nevejde vlastním polem.
  const notes = [
    ["Role", text(body.role) || text(body.typ)],
    ["Kategorie", text(body.kategorie)],
    ["Počet hráčů", text(body.pocet)],
    ["Preferovaný termín", text(body.termin)],
    ["Zpráva", text(body.zprava)],
    ["Stránka", text(body.stranka)],
    ["Jazyk", text(body.jazyk)],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const data = {
    tenantId,
    ownerId,
    firstName,
    lastName,
    companyName: text(body.klub) || null,
    jobTitle: text(body.role) || null,
    email,
    phone: text(body.telefon) || null,
    source: "Web",
    campaign: text(body.zdroj) || null,
    productInterest: text(body.pocet) || null,
    status: "new",
    notes: notes || null,
  };

  // Když stejný e-mail přijde znovu během 24 hodin, nezakládáme duplicitu.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.lead.findFirst({
    where: { tenantId, email, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { id: true, notes: true },
  });

  const lead = recent
    ? await prisma.lead.update({
        where: { id: recent.id },
        data: {
          notes: [recent.notes, `--- Další odeslání ${new Date().toLocaleString("cs-CZ")} ---`, notes]
            .filter(Boolean)
            .join("\n"),
        },
      })
    : await prisma.lead.create({ data });

  await prisma.auditLog.create({
    data: {
      tenantId,
      entityType: "Lead",
      entityId: lead.id,
      action: recent ? "update" : "create",
      changes: JSON.stringify({ source: "web_form", stranka: text(body.stranka) }),
    },
  });

  if (!recent) {
    await prisma.notification.create({
      data: {
        tenantId,
        userId: ownerId,
        type: "lead",
        title: "Nový lead z webu",
        body: [data.companyName, [firstName, lastName].filter(Boolean).join(" "), email]
          .filter(Boolean)
          .join(" · "),
        entityType: "Lead",
        entityId: lead.id,
      },
    });
  }

  return Response.json({ ok: true, id: lead.id, duplicate: Boolean(recent) }, { headers });
}

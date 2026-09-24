// Parsing for the "kluby + družstva + kontakty" CSV export (one row per club × team,
// with the club's secretary / chairman and the team's contact person). Runs in the
// browser: the file (personal contact details) is never stored, only sent in batches.

import { z } from "zod";

export const personSchema = z.object({
  name: z.string().min(1),
  email: z.string().nullable(),
  phone: z.string().nullable(),
});
export type ClubExportPerson = z.infer<typeof personSchema>;

export const clubExportSchema = z.object({
  id: z.string().nullable(),
  name: z.string().min(1),
  city: z.string().nullable(),
  street: z.string().nullable(),
  zip: z.string().nullable(),
  members: z.number().int().nullable(),
  secretary: personSchema.nullable(),
  chairman: personSchema.nullable(),
  teams: z.array(z.object({ category: z.string(), league: z.string().nullable(), contact: personSchema.nullable() })),
});
export type ClubExport = z.infer<typeof clubExportSchema>;

// Minimal RFC-4180-ish parser for ";"-separated files with quoted fields.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ";") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const REQUIRED = ["name", "kategorie", "soutez", "kontaktni_osoba", "sekretar_klubu"];

function person(name: string, email: string, phone: string): ClubExportPerson | null {
  const n = name.trim();
  if (!n) return null;
  return { name: n, email: email.trim() || null, phone: phone.trim() || null };
}

export function parseClubExport(text: string): { clubs: ClubExport[]; rows: number } {
  const [header, ...data] = parseCsv(text);
  const cols = (header ?? []).map((h) => h.trim());
  const missing = REQUIRED.filter((r) => !cols.includes(r));
  if (missing.length) throw new Error(`Soubor nemá očekávané sloupce: ${missing.join(", ")}`);
  const get = (r: string[], key: string) => (r[cols.indexOf(key)] ?? "").trim();

  const clubs = new Map<string, ClubExport>();
  for (const r of data) {
    const name = get(r, "name");
    if (!name) continue;
    const key = get(r, "id") || name.toLowerCase();
    if (!clubs.has(key)) {
      const members = parseInt(get(r, "pocet_clenu"), 10);
      clubs.set(key, {
        id: get(r, "id") || null,
        name,
        city: get(r, "adresa_obec") || get(r, "city") || null,
        street: get(r, "adresa_ulice") || null,
        zip: get(r, "adresa_psc") || null,
        members: Number.isFinite(members) ? members : null,
        secretary: person(get(r, "sekretar_klubu"), get(r, "sekretar_email"), get(r, "sekretar_tel")),
        chairman: person(get(r, "predseda"), get(r, "predseda_email"), get(r, "predseda_tel")),
        teams: [],
      });
    }
    const category = get(r, "kategorie");
    if (category) {
      clubs.get(key)!.teams.push({
        category,
        league: get(r, "soutez") || null,
        contact: person(get(r, "kontaktni_osoba"), get(r, "email"), get(r, "telefon")),
      });
    }
  }
  return { clubs: [...clubs.values()], rows: data.length };
}

// "Mgr. Jan Novák, Ph.D." → titles + first / last name.
export function splitName(full: string) {
  let rest = full.trim().replace(/\s+/g, " ");
  let titleAfter: string | null = null;
  const comma = rest.indexOf(",");
  if (comma > 0) {
    titleAfter = rest.slice(comma + 1).trim() || null;
    rest = rest.slice(0, comma).trim();
  }
  const tokens = rest.split(" ");
  const before: string[] = [];
  while (tokens.length > 2 && /\.$/.test(tokens[0])) before.push(tokens.shift()!);
  const firstName = tokens.shift() ?? rest;
  const lastName = tokens.join(" ") || "—";
  return { firstName, lastName, titleBefore: before.join(" ") || null, titleAfter };
}

import * as XLSX from "xlsx";

export type ParsedTable = { headers: string[]; rows: string[][] };

function fromAoa(aoa: unknown[][]): ParsedTable {
  const [headerRow, ...rest] = aoa;
  const headers = (headerRow ?? []).map((h) => String(h ?? "").trim());
  const rows = rest
    .filter((r) => r.some((cell) => String(cell ?? "").trim() !== ""))
    .map((r) => headers.map((_, i) => String(r[i] ?? "").trim()));
  return { headers, rows };
}

export async function parseImportFile(file: File): Promise<ParsedTable> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
  return fromAoa(aoa);
}

export function parseImportText(text: string): ParsedTable {
  const trimmed = text.trim();
  if (!trimmed) return { headers: [], rows: [] };
  const workbook = XLSX.read(trimmed, { type: "string" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
  return fromAoa(aoa);
}

import { userFromBearer, type TokenUser } from "@/lib/api-tokens";
import { callTool, toolDefinitions, ToolError } from "@/lib/mcp/tools";

export const dynamic = "force-dynamic";

const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "next8-crm", title: "NEXT8 CRM", version: "1.0.0" };
const INSTRUCTIONS =
  "NEXT8 CRM pro sportovní kluby. Kluby = firmy (company), pod nimi týmy a kontakty. " +
  "Nejdřív použijte search_crm pro nalezení ID, pak get_company / list_deals. Částky jsou v CZK. " +
  "Zápisové nástroje (create_task, log_activity, create_lead) zapisují jménem uživatele, kterému patří token.";

type JsonRpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

const rpcError = (id: JsonRpcRequest["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

async function handle(user: TokenUser, msg: JsonRpcRequest) {
  const { id, method, params } = msg;
  switch (method) {
    case "initialize": {
      const requested = String(params?.protocolVersion ?? "");
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        },
      };
    }
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: toolDefinitions() } };
    case "tools/call": {
      const name = String(params?.name ?? "");
      try {
        const data = await callTool(user, name, params?.arguments);
        return {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: { result: data } },
        };
      } catch (e) {
        if (e instanceof ToolError) {
          return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: e.message }], isError: true } };
        }
        console.error("[mcp] tool failed", name, e);
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: "Interní chyba při volání nástroje." }], isError: true } };
      }
    }
    default:
      return rpcError(id, -32601, `Metoda ${method} není podporovaná.`);
  }
}

export async function POST(req: Request) {
  const user = await userFromBearer(req.headers.get("authorization"));
  if (!user) {
    return json(rpcError(null, -32001, "Chybí nebo je neplatný API token (Authorization: Bearer n8_…)."), 401, {
      "WWW-Authenticate": 'Bearer realm="next8-crm"',
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(rpcError(null, -32700, "Neplatný JSON."), 400);
  }

  const messages = (Array.isArray(body) ? body : [body]) as JsonRpcRequest[];
  if (messages.length === 0 || messages.some((m) => !m || typeof m.method !== "string")) {
    return json(rpcError(null, -32600, "Neplatný JSON-RPC požadavek."), 400);
  }

  const requests = messages.filter((m) => m.id !== undefined && m.id !== null);
  if (requests.length === 0) return new Response(null, { status: 202 });

  const responses = await Promise.all(requests.map((m) => handle(user, m)));
  return json(Array.isArray(body) ? responses : responses[0]);
}

export async function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

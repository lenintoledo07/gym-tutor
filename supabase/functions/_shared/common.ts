import { createClient, SupabaseClient, User } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Valida el JWT del usuario y devuelve el usuario + un cliente admin (service role). */
export async function authenticate(req: Request): Promise<{ user: User; admin: SupabaseClient }> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Falta el token de sesión");

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Sesión inválida");
  return { user: data.user, admin };
}

type ClaudeBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

export interface ClaudeRequest {
  system: Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }>;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  tools?: unknown[];
  tool_choice?: unknown;
  max_tokens?: number;
}

export async function callClaude(req: ClaudeRequest): Promise<ClaudeBlock[]> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new HttpError(500, "Falta configurar ANTHROPIC_API_KEY en los secrets de Supabase");
  const model = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-4-5";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ ...req, model, max_tokens: req.max_tokens ?? 2000 }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("Anthropic error", res.status, detail);
    throw new HttpError(502, "El coach no está disponible en este momento. Intenta de nuevo en unos minutos.");
  }
  const body = await res.json();
  return body.content as ClaudeBlock[];
}

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: "Error inesperado" }, 500);
    }
  };
}

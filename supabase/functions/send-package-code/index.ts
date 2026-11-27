import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonObject = Record<string, unknown>;

function json(body: JsonObject, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateCode(): string {
  const maximum = 0x1_0000_0000;
  const limit = maximum - (maximum % 1_000_000);
  const random = new Uint32Array(1);
  do crypto.getRandomValues(random); while (random[0] >= limit);
  return String(random[0] % 1_000_000).padStart(6, "0");
}

function randomSalt(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashCode(salt: string, code: string): Promise<string> {
  const value = new TextEncoder().encode(`${salt}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function maskEmail(email: string): string {
  const [local, domain] = email.trim().split("@");
  if (!local || !domain) return "***";
  const visible = local.length > 1 ? local.slice(0, 2) : local.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;",
  })[character] ?? character);
}

async function resolveSender(apiKey: string): Promise<string | null> {
  const configured = Deno.env.get("EMAIL_FROM")?.trim();
  if (configured) return configured;

  try {
    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => ({}));
    const domains = Array.isArray(payload.data) ? payload.data : [];
    const verified = domains.find((domain: unknown) => {
      if (!domain || typeof domain !== "object") return false;
      const item = domain as Record<string, unknown>;
      return item.status === "verified" && typeof item.name === "string";
    }) as Record<string, unknown> | undefined;
    return verified ? `Acex Portaria <portaria@${String(verified.name)}>` : null;
  } catch {
    return null;
  }
}

async function sendWithResend(
  email: string,
  residentName: string,
  packageCreatedAt: string,
  code: string,
): Promise<{ sent: boolean; providerId: string | null; reason: string | null }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return { sent: false, providerId: null, reason: "provider_not_configured" };
  const from = await resolveSender(apiKey);
  if (!from) return { sent: false, providerId: null, reason: "sender_not_configured" };

  const date = new Date(packageCreatedAt).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
  const safeName = escapeHtml(residentName);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Código de retirada da sua encomenda",
      text: `Olá, ${residentName}.\n\nUma encomenda registrada em ${date} está aguardando retirada.\n\nCódigo: ${code}\n\nO código é válido por 72 horas. Não o compartilhe com pessoas não autorizadas.\n\nAcex Portaria`,
      html: `<p>Olá, ${safeName}.</p><p>Uma encomenda registrada em ${date} está aguardando retirada.</p><p>Seu código é:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px">${code}</p><p>O código é válido por 72 horas. Não o compartilhe com pessoas não autorizadas.</p><p>Acex Portaria</p>`,
    }),
  });

  if (!response.ok) {
    const providerError = await response.json().catch(() => ({}));
    console.error("Resend delivery rejected", {
      status: response.status,
      name: typeof providerError.name === "string" ? providerError.name : null,
      message: typeof providerError.message === "string" ? providerError.message : null,
    });
    return { sent: false, providerId: null, reason: "provider_rejected" };
  }

  const result = await response.json().catch(() => ({}));
  return { sent: true, providerId: typeof result.id === "string" ? result.id : null, reason: null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Requisição inválida" }, 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "Requisição inválida" }, 400);
    }
    const keys = Object.keys(body);
    const packageId = (body as JsonObject).packageId;
    if (keys.length !== 1 || keys[0] !== "packageId" ||
      typeof packageId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(packageId)) {
      return json({ error: "Requisição inválida" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("server_configuration");

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const token = authHeader.slice("Bearer ".length);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Não autorizado" }, 401);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, status, condominium_id")
      .eq("id", user.id)
      .single();
    if (profileError || !profile || profile.status !== "active" ||
      !["admin", "doorman"].includes(profile.role)) {
      return json({ error: "Acesso negado" }, 403);
    }

    const code = generateCode();
    const salt = randomSalt();
    const codeHash = await hashCode(salt, code);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    const { data: rotation, error: rotationError } = await supabase.rpc(
      "rotate_package_pickup_code",
      {
        p_package_id: packageId,
        p_profile_id: profile.id,
        p_code_hash: codeHash,
        p_code_salt: salt,
        p_expires_at: expiresAt,
      },
    );

    if (rotationError) throw new Error("code_rotation_failed");
    if (!rotation?.ok) {
      const status = rotation?.reason === "forbidden" ? 403 : 404;
      return json({ error: status === 403 ? "Acesso negado" : "Encomenda indisponível" }, status);
    }

    let delivery = { sent: false, providerId: null as string | null, reason: null as string | null };
    try {
      delivery = await sendWithResend(
        rotation.resident_email,
        rotation.resident_name,
        rotation.package_created_at,
        code,
      );
    } catch {
      console.error("Resend delivery failed");
      delivery.reason = "provider_unavailable";
    }

    const now = new Date().toISOString();
    const deliveryStatus = delivery.sent ? "sent" : "failed";
    await supabase.from("packages").update({
      email_delivery_status: deliveryStatus,
      email_last_sent_at: delivery.sent ? now : null,
    }).eq("id", packageId);

    const metadata: JsonObject = {
      delivery_status: deliveryStatus,
      resend_count: rotation.resend_count,
    };
    if (delivery.providerId) metadata.provider_id = delivery.providerId;
    if (delivery.reason) metadata.failure_reason = delivery.reason;
    const { error: historyError } = await supabase.from("package_pickup_events").insert({
      package_id: packageId,
      resident_id: rotation.resident_id,
      profile_id: profile.id,
      condominium_id: rotation.condominium_id,
      event_type: delivery.sent
        ? (rotation.resend_count > 0 ? "code_resent" : "email_sent")
        : "email_failed",
      metadata,
    });
    if (historyError) console.error("Package history write failed");

    return json({
      success: true,
      deliveryStatus,
      deliveryReason: delivery.reason,
      maskedEmail: maskEmail(rotation.resident_email),
    });
  } catch {
    console.error("send-package-code unexpected failure");
    return json({ error: "Não foi possível concluir a solicitação" }, 500);
  }
});

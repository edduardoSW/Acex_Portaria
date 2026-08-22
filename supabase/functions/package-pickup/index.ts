import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "create" | "resend" | "regenerate" | "confirm";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateCode() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return String(100000 + (value[0] % 900000));
}

function randomSalt() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashCode(salt: string, code: string) {
  const data = new TextEncoder().encode(`${salt}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sendEmail(to: string, residentName: string, createdAt: string, code: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");
  const systemUrl = Deno.env.get("SYSTEM_URL");
  if (!apiKey || !from || !to) return { sent: false, providerId: null };

  const date = new Date(createdAt).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
  const safeName = residentName.replace(/[<>&"']/g, "");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Sua encomenda chegou à portaria",
      text: `Olá, ${residentName}.\n\nUma encomenda foi registrada para você em ${date}.\n\nCódigo para retirada: ${code}\n\nInforme esse código ao porteiro no momento da retirada. Não compartilhe o código com pessoas não autorizadas.\n\nAcex Portaria${systemUrl ? `\n${systemUrl}` : ""}`,
      html: `<p>Olá, ${safeName}.</p><p>Uma encomenda foi registrada para você em ${date}.</p><p>Código para retirada:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px">${code}</p><p>Informe esse código ao porteiro no momento da retirada. Não compartilhe o código com pessoas não autorizadas.</p><p>Acex Portaria</p>${systemUrl ? `<p><a href="${systemUrl}">${systemUrl}</a></p>` : ""}`,
    }),
  });

  if (!response.ok) {
    console.error("Resend rejected email", response.status, await response.text());
    return { sent: false, providerId: null };
  }
  const result = await response.json();
  return { sent: true, providerId: result.id ?? null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return json({ error: "Não autorizado" }, 401);

    const { data: profile } = await supabase.from("profiles")
      .select("id, role, status, condominium_id").eq("id", user.id).single();
    if (!profile || profile.role !== "doorman" || profile.status !== "active") {
      return json({ error: "Não autorizado" }, 403);
    }

    const body = await req.json();
    const action = body.action as Action;
    if (!(["create", "resend", "regenerate", "confirm"] as Action[]).includes(action)) {
      return json({ error: "Ação inválida" }, 400);
    }

    if (action === "confirm") {
      const code = String(body.code ?? "").trim();
      if (!body.packageId || !/^\d{6}$/.test(code)) {
        return json({ success: false, reason: "invalid", message: "Código inválido. Confirme com o destinatário" });
      }
      const { data, error } = await supabase.rpc("verify_package_pickup_code", {
        p_package_id: body.packageId,
        p_code: code,
        p_profile_id: profile.id,
      });
      if (error) throw error;
      if (data?.ok) return json({ success: true, message: "Código confirmado. Entrega autorizada" });
      if (data?.reason === "locked") {
        return json({ success: false, reason: "locked", retryAfterSeconds: data.retry_after_seconds, message: "Limite de tentativas atingido. Tente novamente em 10 minutos" });
      }
      return json({ success: false, reason: data?.reason ?? "invalid", remainingAttempts: data?.remaining_attempts, message: "Código inválido. Confirme com o destinatário" });
    }

    let packageData: any;
    if (action === "create") {
      const { data: resident } = await supabase.from("residents")
        .select("id, name, email, condominium_id").eq("id", body.residentId).single();
      if (!resident || resident.condominium_id !== profile.condominium_id) {
        return json({ error: "Não foi possível registrar a encomenda" }, 400);
      }
      const { data, error } = await supabase.from("packages").insert({
        resident_id: resident.id,
        status: "pending",
        registered_by: profile.id,
        condominium_id: profile.condominium_id,
        notification_status: "pending",
        email_delivery_status: "pending",
      }).select("id, resident_id, condominium_id, created_at, resident:residents(id,name,email)").single();
      if (error) throw error;
      packageData = data;
      await supabase.from("activity_logs").insert({ action: "package_created", profile_id: profile.id, package_id: data.id, condominium_id: profile.condominium_id });

      // O envio do primeiro código é responsabilidade exclusiva de send-package-code.
      // Retornar aqui evita gerar um código e disparar um e-mail pelo fluxo legado.
      return json({
        success: true,
        packageId: data.id,
        message: "Encomenda registrada com sucesso",
      });
    } else {
      const { data } = await supabase.from("packages")
        .select("id, resident_id, condominium_id, created_at, status, resident:residents(id,name,email)")
        .eq("id", body.packageId).single();
      if (!data || data.condominium_id !== profile.condominium_id || data.status !== "pending") {
        return json({ error: "Não foi possível processar a solicitação" }, 400);
      }
      packageData = data;
      await supabase.from("package_pickup_codes").update({ active: false, invalidated_at: new Date().toISOString() })
        .eq("package_id", data.id).eq("active", true);
    }

    const resident = Array.isArray(packageData.resident) ? packageData.resident[0] : packageData.resident;
    const code = generateCode();
    const salt = randomSalt();
    const codeHash = await hashCode(salt, code);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    const { error: codeError } = await supabase.from("package_pickup_codes").insert({
      package_id: packageData.id,
      resident_id: packageData.resident_id,
      code_hash: codeHash,
      code_salt: salt,
      expires_at: expiresAt,
    });
    if (codeError) throw codeError;

    let emailResult = { sent: false, providerId: null as string | null };
    try {
      emailResult = await sendEmail(resident?.email ?? "", resident?.name ?? "Morador", packageData.created_at, code);
    } catch (emailError) {
      console.error("Email delivery failed", emailError);
    }

    await supabase.from("packages").update({
      email_delivery_status: emailResult.sent ? "sent" : "failed",
      email_last_sent_at: emailResult.sent ? new Date().toISOString() : null,
    }).eq("id", packageData.id);

    const eventType = emailResult.sent
      ? (action === "resend" ? "code_resent" : action === "regenerate" ? "code_regenerated" : "email_sent")
      : "email_failed";
    await supabase.from("package_pickup_events").insert({
      package_id: packageData.id,
      resident_id: packageData.resident_id,
      profile_id: profile.id,
      condominium_id: profile.condominium_id,
      event_type: eventType,
      metadata: emailResult.providerId ? { provider_id: emailResult.providerId } : {},
    });

    return json({
      success: true,
      packageId: packageData.id,
      emailSent: emailResult.sent,
      message: emailResult.sent ? "Encomenda registrada. E-mail enviado com sucesso" : "Encomenda registrada, mas não foi possível enviar o e-mail",
    });
  } catch (error) {
    console.error("package-pickup unexpected error", error);
    return json({ error: "Não foi possível concluir a operação" }, 500);
  }
});

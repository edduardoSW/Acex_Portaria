import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type LeadPayload = {
  name?: string;
  condominium?: string;
  email?: string;
  phone?: string;
  units?: number;
  message?: string;
  website?: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function calculatePlan(units: number) {
  if (units <= 150) return { name: "Essencial", price: 199 };
  if (units <= 350) return { name: "Profissional", price: 349 };
  if (units <= 600) return { name: "Enterprise", price: 599 };
  return { name: "Personalizado", price: null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método não permitido." }, 405);
  }

  try {
    const payload = (await req.json()) as LeadPayload;

    // Campo invisível: bots costumam preenchê-lo. Retornamos sucesso para não
    // revelar o mecanismo antispam, mas nenhum e-mail é enviado.
    if (payload.website) return json({ success: true });

    const name = String(payload.name ?? "").trim().slice(0, 100);
    const condominium = String(payload.condominium ?? "").trim().slice(0, 120);
    const email = String(payload.email ?? "").trim().toLowerCase().slice(0, 160);
    const phone = String(payload.phone ?? "").trim().slice(0, 24);
    const message = String(payload.message ?? "").trim().slice(0, 1000);
    const units = Math.floor(Number(payload.units));

    if (!name || !condominium || !phone || !Number.isFinite(units) || units < 1 || units > 5000) {
      return json({ error: "Preencha os dados obrigatórios corretamente." }, 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Informe um e-mail válido." }, 400);
    }

    const apiKey = Deno.env.get("RESEND_API_KEY");
    const emailFrom = Deno.env.get("EMAIL_FROM");
    const salesEmail = Deno.env.get("SALES_EMAIL");

    if (!apiKey || !emailFrom || !salesEmail) {
      console.error("Missing RESEND_API_KEY, EMAIL_FROM or SALES_EMAIL");
      return json({ error: "Canal de vendas ainda não configurado." }, 503);
    }

    const plan = calculatePlan(units);
    const safe = {
      name: escapeHtml(name),
      condominium: escapeHtml(condominium),
      email: escapeHtml(email),
      phone: escapeHtml(phone),
      message: escapeHtml(message).replaceAll("\n", "<br>"),
    };
    const priceText = plan.price ? `R$ ${plan.price}/mês` : "Proposta personalizada";

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [salesEmail],
        reply_to: email,
        subject: `Novo lead ACEX · ${condominium} · ${units} unidades`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#13252f">
            <div style="background:#092b3d;padding:24px;border-radius:16px 16px 0 0">
              <strong style="color:#fff;font-size:22px;letter-spacing:2px">ACEX</strong>
              <p style="color:#b8d83d;margin:8px 0 0">Nova solicitação comercial</p>
            </div>
            <div style="border:1px solid #dfe7e7;border-top:0;padding:28px;border-radius:0 0 16px 16px">
              <h1 style="font-size:24px;margin:0 0 22px">${safe.condominium}</h1>
              <table style="width:100%;border-collapse:collapse">
                <tr><td style="padding:10px 0;color:#64748b">Responsável</td><td style="padding:10px 0;font-weight:bold">${safe.name}</td></tr>
                <tr><td style="padding:10px 0;color:#64748b">E-mail</td><td style="padding:10px 0">${safe.email}</td></tr>
                <tr><td style="padding:10px 0;color:#64748b">Telefone</td><td style="padding:10px 0">${safe.phone}</td></tr>
                <tr><td style="padding:10px 0;color:#64748b">Unidades</td><td style="padding:10px 0;font-weight:bold">${units}</td></tr>
                <tr><td style="padding:10px 0;color:#64748b">Plano calculado</td><td style="padding:10px 0;font-weight:bold">${plan.name} · ${priceText}</td></tr>
              </table>
              ${safe.message ? `<div style="margin-top:22px;padding:18px;background:#f5f8f8;border-radius:12px"><strong>Mensagem</strong><p style="line-height:1.6;margin-bottom:0">${safe.message}</p></div>` : ""}
            </div>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      console.error("Resend error:", response.status, responseBody);
      return json({ error: "Não foi possível enviar a proposta agora." }, 502);
    }

    return json({ success: true, plan: plan.name, price: plan.price });
  } catch (error) {
    console.error("send-sales-lead error:", error);
    return json({ error: "Não foi possível processar a solicitação." }, 500);
  }
});

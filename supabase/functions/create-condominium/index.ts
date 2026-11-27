import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const prices = { essential: 199, professional: 349, enterprise: 599 } as const;
type Plan = keyof typeof prices;

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Metodo nao permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const systemUrl = Deno.env.get("SYSTEM_URL")?.trim();
  const authHeader = request.headers.get("Authorization");

  if (!supabaseUrl || !serviceRoleKey) {
    return response({ error: "A funcao de cadastro ainda nao foi configurada." }, 500);
  }
  if (!systemUrl || !/^https:\/\//.test(systemUrl)) {
    return response({
      error: "Configure o secret SYSTEM_URL com a URL HTTPS publica do sistema antes de enviar convites.",
    }, 500);
  }
  if (!authHeader?.startsWith("Bearer ")) {
    return response({ error: "Sessao nao encontrada. Entre novamente." }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = authHeader.slice("Bearer ".length);
  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authData.user) return response({ error: "Sessao invalida ou expirada." }, 401);

  const { data: requester } = await adminClient
    .from("profiles")
    .select("role, status")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (requester?.role !== "general_manager" || requester.status !== "active") {
    return response({ error: "Somente o gerenciador geral pode cadastrar condominios." }, 403);
  }

  let condominiumId: string | null = null;
  let invitedUserId: string | null = null;

  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim().slice(0, 120);
    const contactName = String(body.contact_name ?? "").trim().slice(0, 100);
    const contactEmail = String(body.contact_email ?? "").trim().toLowerCase().slice(0, 160);
    const city = String(body.city ?? "").trim().slice(0, 100) || null;
    const state = String(body.state ?? "").trim().toUpperCase().slice(0, 2) || null;
    const units = Number(body.units_count);
    const plan = String(body.plan ?? "") as Plan;

    if (!name || !contactName || !contactEmail || !contactEmail.includes("@") || !Number.isInteger(units) || units < 1 || !Object.hasOwn(prices, plan)) {
      return response({ error: "Preencha corretamente os dados do condominio e do sindico." }, 400);
    }

    const { data: condominium, error: condominiumError } = await adminClient
      .from("condominiums")
      .insert({
        name,
        city,
        state,
        units_count: units,
        plan,
        monthly_value: prices[plan],
        subscription_status: "trial",
        contact_name: contactName,
        contact_email: contactEmail,
        trial_ends_at: new Date(Date.now() + 15 * 86400000).toISOString(),
      })
      .select("id")
      .single();

    if (condominiumError || !condominium) {
      throw new Error(condominiumError?.message ?? "Nao foi possivel criar o condominio.");
    }
    condominiumId = condominium.id;

    // Nunca use o Origin da requisicao aqui: durante o desenvolvimento ele e
    // localhost e produziria um convite inutil para o destinatario.
    const redirectTo = `${systemUrl.replace(/\/$/, "")}/redefinir-senha`;
    const { data: invitation, error: invitationError } = await adminClient.auth.admin.inviteUserByEmail(contactEmail, {
      redirectTo,
      data: { name: contactName, role: "admin", condominium_id: condominiumId },
    });
    if (invitationError || !invitation.user) {
      throw new Error(invitationError?.message ?? "Nao foi possivel enviar o convite ao sindico.");
    }
    invitedUserId = invitation.user.id;

    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: invitedUserId,
      email: contactEmail,
      name: contactName,
      role: "admin",
      condominium_id: condominiumId,
      status: "active",
    }, { onConflict: "id" });
    if (profileError) throw new Error(profileError.message);

    return response({ message: "Condominio criado e convite enviado ao sindico.", condominium_id: condominiumId }, 201);
  } catch (error) {
    if (invitedUserId) await adminClient.auth.admin.deleteUser(invitedUserId);
    if (condominiumId) await adminClient.from("condominiums").delete().eq("id", condominiumId);
    return response({ error: error instanceof Error ? error.message : "Nao foi possivel concluir o cadastro." }, 400);
  }
});


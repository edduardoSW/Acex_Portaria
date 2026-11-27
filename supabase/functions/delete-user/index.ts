import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Metodo nao permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Configuracao interna da funcao incompleta." }, 500);
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Sessao nao encontrada. Entre novamente." }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = authHeader.slice("Bearer ".length).trim();
  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authData.user) {
    return jsonResponse({ error: "Sessao invalida ou expirada. Entre novamente." }, 401);
  }

  const { data: requester, error: requesterError } = await adminClient
    .from("profiles")
    .select("id, role, status, condominium_id")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (requesterError || !requester || requester.status !== "active") {
    return jsonResponse({ error: "Perfil ativo do solicitante nao encontrado." }, 403);
  }
  if (!["admin", "general_manager"].includes(requester.role)) {
    return jsonResponse({ error: "Voce nao tem permissao para excluir usuarios." }, 403);
  }

  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Corpo da requisicao invalido." }, 400);
  }

  const userId = body.userId?.trim();
  if (!userId) return jsonResponse({ error: "Informe o usuario que sera excluido." }, 400);
  if (userId === requester.id) {
    return jsonResponse({ error: "Voce nao pode excluir o proprio acesso." }, 400);
  }

  const { data: target, error: targetError } = await adminClient
    .from("profiles")
    .select("id, name, role, condominium_id")
    .eq("id", userId)
    .maybeSingle();
  if (targetError) return jsonResponse({ error: `Erro ao localizar usuario: ${targetError.message}` }, 500);
  if (!target) return jsonResponse({ error: "Usuario nao encontrado." }, 404);

  if (requester.role === "admin" && target.condominium_id !== requester.condominium_id) {
    return jsonResponse({ error: "Voce so pode excluir usuarios do seu condominio." }, 403);
  }
  if (requester.role === "admin" && target.role === "general_manager") {
    return jsonResponse({ error: "Administradores nao podem excluir um gerenciador geral." }, 403);
  }

  const [{ count: packageCount, error: packageError }, { count: logCount, error: logError }] = await Promise.all([
    adminClient
      .from("packages")
      .select("id", { count: "exact", head: true })
      .or(`registered_by.eq.${userId},delivered_by.eq.${userId}`),
    adminClient
      .from("activity_logs")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", userId),
  ]);

  if (packageError || logError) {
    console.error("Erro ao verificar historico:", packageError ?? logError);
    return jsonResponse({ error: "Nao foi possivel verificar o historico do usuario." }, 500);
  }

  const hasHistory = (packageCount ?? 0) > 0 || (logCount ?? 0) > 0;
  if (hasHistory) {
    const { error: deactivateError } = await adminClient
      .from("profiles")
      .update({ status: "inactive" })
      .eq("id", userId);
    if (deactivateError) {
      return jsonResponse({ error: `Nao foi possivel desativar o usuario: ${deactivateError.message}` }, 400);
    }

    // Mantem o perfil para preservar o historico e bloqueia o login no Auth.
    const { error: banError } = await adminClient.auth.admin.updateUserById(userId, {
      ban_duration: "876000h",
    });
    if (banError) {
      await adminClient.from("profiles").update({ status: "active" }).eq("id", userId);
      return jsonResponse({ error: `Nao foi possivel bloquear o acesso: ${banError.message}` }, 400);
    }

    await adminClient.from("activity_logs").insert({
      action: "user_deactivated",
      profile_id: requester.id,
      package_id: null,
      condominium_id: target.condominium_id ?? requester.condominium_id,
    });
    return jsonResponse({ success: true, action: "deactivated" });
  }

  const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteAuthError) {
    return jsonResponse({ error: `Nao foi possivel excluir o acesso: ${deleteAuthError.message}` }, 400);
  }

  // Em projetos sem cascade entre auth.users e profiles, garante a limpeza do perfil.
  const { error: deleteProfileError } = await adminClient.from("profiles").delete().eq("id", userId);
  if (deleteProfileError) console.warn("Auth excluido, mas o perfil exigiu limpeza manual:", deleteProfileError);

  await adminClient.from("activity_logs").insert({
    action: "user_deleted",
    profile_id: requester.id,
    package_id: null,
    condominium_id: target.condominium_id ?? requester.condominium_id,
  });

  return jsonResponse({ success: true, action: "deleted" });
});

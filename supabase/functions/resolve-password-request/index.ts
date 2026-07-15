import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ResolvePasswordRequestBody {
  requestId?: string;
  newPassword?: string;
}

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_TOO_SHORT_MESSAGE = "A senha deve conter no mínimo 8 caracteres.";

function validatePassword(password: string): string | null {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return PASSWORD_TOO_SHORT_MESSAGE;
  }
  return null;
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

serve(async (req: Request) => {
  // Necessário para chamadas feitas pelo navegador
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Método não permitido." },
      405,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY",
  );

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.",
    );

    return jsonResponse(
      { error: "Configuração interna da função incompleta." },
      500,
    );
  }

  const authHeader = req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse(
      { error: "Sessão não encontrada. Entre novamente." },
      401,
    );
  }

  const token = authHeader.slice("Bearer ".length).trim();

  const supabaseAdmin = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  try {
    // Validar a sessão do administrador
    const {
      data: { user: requester },
      error: requesterError,
    } = await supabaseAdmin.auth.getUser(token);

    if (requesterError || !requester) {
      console.error(
        "Erro ao validar sessão:",
        requesterError,
      );

      return jsonResponse(
        { error: "Sessão inválida ou expirada." },
        401,
      );
    }

    // Buscar perfil do administrador
    const {
      data: adminProfile,
      error: adminProfileError,
    } = await supabaseAdmin
      .from("profiles")
      .select("id, role, status, condominium_id")
      .eq("id", requester.id)
      .maybeSingle();

    if (adminProfileError) {
      console.error(
        "Erro ao buscar perfil do administrador:",
        adminProfileError,
      );

      return jsonResponse(
        {
          error:
            `Erro ao carregar perfil: ${adminProfileError.message}`,
        },
        500,
      );
    }

    if (!adminProfile) {
      return jsonResponse(
        { error: "Perfil do administrador não encontrado." },
        403,
      );
    }

    if (adminProfile.role !== "admin") {
      return jsonResponse(
        {
          error:
            "Somente administradores podem redefinir senhas.",
        },
        403,
      );
    }

    if (
      adminProfile.status &&
      adminProfile.status !== "active"
    ) {
      return jsonResponse(
        { error: "Este administrador está inativo." },
        403,
      );
    }

    const body =
      (await req.json()) as ResolvePasswordRequestBody;

    const requestId = body.requestId?.trim();
    const newPassword = body.newPassword;

    if (!requestId || !newPassword) {
      return jsonResponse(
        {
          error:
            "Informe a solicitação e a nova senha.",
        },
        400,
      );
    }

    const passwordError = validatePassword(newPassword);

    if (passwordError) {
      return jsonResponse({ error: passwordError }, 400);
    }

    // Buscar a solicitação
    const {
      data: passwordResetRequest,
      error: requestError,
    } = await supabaseAdmin
      .from("password_reset_requests")
      .select(
        `
          id,
          profile_id,
          email,
          status,
          condominium_id,
          resolved_at,
          resolved_by
        `,
      )
      .eq("id", requestId)
      .maybeSingle();

    if (requestError) {
      console.error(
        "Erro ao buscar solicitação:",
        requestError,
      );

      return jsonResponse(
        {
          error:
            `Erro ao buscar solicitação: ${requestError.message}`,
        },
        500,
      );
    }

    if (!passwordResetRequest) {
      return jsonResponse(
        { error: "Solicitação não encontrada." },
        404,
      );
    }

    // Garantir que pertence ao mesmo condomínio
    if (
      passwordResetRequest.condominium_id !==
      adminProfile.condominium_id
    ) {
      return jsonResponse(
        {
          error:
            "Você não possui permissão para resolver esta solicitação.",
        },
        403,
      );
    }

    if (passwordResetRequest.status !== "pending") {
      return jsonResponse(
        {
          error:
            "Esta solicitação não está mais pendente.",
        },
        400,
      );
    }

    // Confirmar que o perfil solicitado ainda existe
    const {
      data: targetProfile,
      error: targetProfileError,
    } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, email, status, condominium_id",
      )
      .eq("id", passwordResetRequest.profile_id)
      .maybeSingle();

    if (targetProfileError) {
      console.error(
        "Erro ao buscar perfil do usuário:",
        targetProfileError,
      );

      return jsonResponse(
        {
          error:
            `Erro ao buscar usuário: ${targetProfileError.message}`,
        },
        500,
      );
    }

    if (!targetProfile) {
      return jsonResponse(
        {
          error:
            "O usuário desta solicitação não foi encontrado.",
        },
        404,
      );
    }

    if (
      targetProfile.condominium_id !==
      adminProfile.condominium_id
    ) {
      return jsonResponse(
        {
          error:
            "O usuário pertence a outro condomínio.",
        },
        403,
      );
    }

    if (
      targetProfile.status &&
      targetProfile.status !== "active"
    ) {
      return jsonResponse(
        { error: "Este usuário está inativo." },
        400,
      );
    }

    /*
     * O ID do profile é o mesmo ID do auth.users.
     */
    const { error: updateUserError } =
      await supabaseAdmin.auth.admin.updateUserById(
        targetProfile.id,
        {
          password: newPassword,
        },
      );

    if (updateUserError) {
      console.error(
        "Erro ao atualizar senha no Auth:",
        updateUserError,
      );

      return jsonResponse(
        {
          error:
            `Não foi possível atualizar a senha: ${updateUserError.message}`,
        },
        400,
      );
    }

    const resolvedAt = new Date().toISOString();

    // Marcar solicitação como resolvida
    const {
      data: updatedRequest,
      error: updateRequestError,
    } = await supabaseAdmin
      .from("password_reset_requests")
      .update({
        status: "resolved",
        resolved_at: resolvedAt,
        resolved_by: adminProfile.id,
      })
      .eq("id", requestId)
      .eq("status", "pending")
      .select("id, status, resolved_at, resolved_by")
      .maybeSingle();

    if (updateRequestError) {
      console.error(
        "Senha alterada, mas houve erro ao atualizar solicitação:",
        updateRequestError,
      );

      return jsonResponse(
        {
          error:
            "A senha foi atualizada, mas não foi possível concluir o registro da solicitação.",
        },
        500,
      );
    }

    if (!updatedRequest) {
      return jsonResponse(
        {
          error:
            "A solicitação já havia sido processada.",
        },
        409,
      );
    }

    // Registrar activity log
    const { error: logError } = await supabaseAdmin
      .from("activity_logs")
      .insert({
        action: "password_reset_resolved",
        profile_id: adminProfile.id,
        package_id: null,
        condominium_id: adminProfile.condominium_id,
      });

    if (logError) {
      console.warn(
        "Senha redefinida, mas o log não foi criado:",
        logError,
      );
    }

    return jsonResponse(
      {
        success: true,
        message: "Senha redefinida com sucesso.",
      },
      200,
    );
  } catch (error) {
    console.error(
      "Erro inesperado em resolve-password-request:",
      error,
    );

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno inesperado.",
      },
      500,
    );
  }
});

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RequestPasswordResetBody = {
  email?: string;
};

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

serve(async (req) => {
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
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.",
    );
    return jsonResponse(
      { error: "Configuração interna da função incompleta." },
      500,
    );
  }

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
    const body = (await req.json()) as RequestPasswordResetBody;
    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    if (!email) {
      return jsonResponse(
        { error: "Informe um e-mail válido." },
        400,
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabaseAdmin
      .from("profiles")
      .select("id, email, status, condominium_id")
      .eq("email", email)
      .maybeSingle();

    if (profileError) {
      console.error("Erro ao buscar perfil:", {
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
      });

      return jsonResponse(
        { error: "Não foi possível validar o e-mail informado." },
        500,
      );
    }

    if (!profile) {
      return jsonResponse(
        { error: "Este e-mail não foi cadastrado pelo administrador." },
        404,
      );
    }

    if (profile.status !== "active") {
      return jsonResponse(
        { error: "Este usuário está inativo." },
        400,
      );
    }

    const {
      data: existingRequest,
      error: existingRequestError,
    } = await supabaseAdmin
      .from("password_reset_requests")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingRequestError) {
      console.error("Erro ao buscar solicitação pendente:", {
        code: existingRequestError.code,
        message: existingRequestError.message,
        details: existingRequestError.details,
        hint: existingRequestError.hint,
      });

      return jsonResponse(
        { error: "Não foi possível verificar solicitações pendentes." },
        500,
      );
    }

    if (existingRequest) {
      return jsonResponse(
        { error: "Já existe uma solicitação de redefinição pendente." },
        409,
      );
    }

    const { error: insertError } = await supabaseAdmin
      .from("password_reset_requests")
      .insert({
        profile_id: profile.id,
        email: profile.email,
        condominium_id: profile.condominium_id,
        status: "pending",
      });

    if (insertError) {
      console.error("Erro ao criar solicitação de redefinição:", {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
      });

      return jsonResponse(
        { error: "Não foi possível criar a solicitação de redefinição." },
        500,
      );
    }

    const { error: logError } = await supabaseAdmin
      .from("activity_logs")
      .insert({
        action: "password_reset_requested",
        profile_id: profile.id,
        package_id: null,
        condominium_id: profile.condominium_id,
      });

    if (logError) {
      console.error("Erro ao registrar activity log:", {
        code: logError.code,
        message: logError.message,
        details: logError.details,
        hint: logError.hint,
      });
    }

    return jsonResponse({
      success: true,
      message: "Solicitação de redefinição criada com sucesso.",
    });
  } catch (error) {
    console.error(
      "Erro inesperado em request-password-reset:",
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

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type UserRole = "admin" | "doorman";

interface CreateUserBody {
  email?: string;
  password?: string;
  name?: string;
  role?: UserRole;
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
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Secrets obrigatórios não configurados.");

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

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let createdAuthUserId: string | null = null;

  try {
    const {
      data: { user: requester },
      error: requesterError,
    } = await supabaseAdmin.auth.getUser(token);

    if (requesterError || !requester) {
      console.error("Falha ao validar sessão:", requesterError);

      return jsonResponse(
        { error: "Sessão inválida ou expirada. Entre novamente." },
        401,
      );
    }

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
        "Erro ao carregar perfil do solicitante:",
        adminProfileError,
      );

      return jsonResponse(
        {
          error: `Erro ao carregar perfil: ${adminProfileError.message}`,
        },
        500,
      );
    }

    if (!adminProfile) {
      return jsonResponse(
        { error: "O perfil do administrador não foi encontrado." },
        403,
      );
    }

    if (adminProfile.role !== "admin") {
      return jsonResponse(
        { error: "Somente administradores podem criar usuários." },
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

    const body = (await req.json()) as CreateUserBody;

    const email = body.email?.trim().toLowerCase();
    const password =
      typeof body.password === "string" ? body.password : undefined;
    const name = body.name?.trim();
    const role = body.role;

    if (!email || !password || !name || !role) {
      return jsonResponse(
        { error: "Preencha nome, e-mail, senha e função." },
        400,
      );
    }

    if (!["admin", "doorman"].includes(role)) {
      return jsonResponse(
        { error: "A função informada é inválida." },
        400,
      );
    }

    const passwordError = validatePassword(password);

    if (passwordError) {
      return jsonResponse({ error: passwordError }, 400);
    }

    const {
      data: authData,
      error: authError,
    } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role,
        condominium_id: adminProfile.condominium_id,
      },
    });

    if (authError || !authData.user) {
      console.error("Erro ao criar usuário no Auth:", authError);

      return jsonResponse(
        {
          error:
            authError?.message ??
            "Não foi possível criar o usuário no Authentication.",
        },
        400,
      );
    }

    createdAuthUserId = authData.user.id;

    const {
      data: profileData,
      error: profileError,
    } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: authData.user.id,
          email,
          name,
          role,
          condominium_id: adminProfile.condominium_id,
          status: "active",
        },
        {
          onConflict: "id",
        },
      )
      .select(
        "id, email, name, role, status, condominium_id, created_at",
      )
      .single();

    if (profileError) {
      console.error("Erro ao criar perfil:", profileError);

      const { error: rollbackError } =
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

      if (rollbackError) {
        console.error("Erro no rollback do Auth:", rollbackError);
      }

      return jsonResponse(
        { error: `Erro ao criar perfil: ${profileError.message}` },
        400,
      );
    }

    /*
     * A tabela activity_logs possui:
     * action, profile_id, package_id, condominium_id e created_at.
     * package_id fica nulo porque esta ação não se refere a encomenda.
     */
    const { error: logError } = await supabaseAdmin
      .from("activity_logs")
      .insert({
        action: "user_created",
        profile_id: adminProfile.id,
        package_id: null,
        condominium_id: adminProfile.condominium_id,
      });

    if (logError) {
      console.warn(
        "Usuário criado, mas o log não foi salvo:",
        logError,
      );
    }

    return jsonResponse(
      {
        message: "Usuário criado com sucesso.",
        user: profileData,
      },
      201,
    );
  } catch (error) {
    console.error("Erro inesperado em create-user:", error);

    if (createdAuthUserId) {
      const { error: rollbackError } =
        await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);

      if (rollbackError) {
        console.error("Erro no rollback inesperado:", rollbackError);
      }
    }

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

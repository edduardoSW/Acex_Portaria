// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

console.log("Hello from Functions!");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Create a Supabase client with the service role key
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(
        { error: "Authorization header is required" },
        401,
      );
    }

    // Get user from JWT
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);
    if (userError) {
      console.error("Error getting user:", userError);
      return jsonResponse(
        { error: "Invalid token" },
        401,
      );
    }

    // Get the admin's profile to verify they are an admin and get their condo ID
    const { data: adminProfile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (profileError) {
      console.error("Error getting admin profile:", profileError);
      return jsonResponse(
        { error: "Profile not found" },
        401,
      );
    }

    if (adminProfile.role !== "admin") {
      return jsonResponse(
        { error: "Not authorized" },
        403,
      );
    }

    // Get the request body
    const { userId, name, role, email, password, status } = await req.json();
    const nextPassword =
      typeof password === "string" ? password : password === undefined ? undefined : "";

    if (nextPassword !== undefined) {
      const passwordError = validatePassword(nextPassword);

      if (passwordError) {
        return jsonResponse(
          { error: passwordError },
          400,
        );
      }
    }

    // Get the user's profile to verify they belong to the same condo
    const { data: userProfile, error: userProfileError } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (userProfileError) {
      console.error("Error getting user profile:", userProfileError);
      return jsonResponse(
        { error: "User not found" },
        404,
      );
    }

    if (userProfile.condominium_id !== adminProfile.condominium_id) {
      return jsonResponse(
        { error: "Not authorized" },
        403,
      );
    }

    // Prevent admin from deactivating or deleting the last active admin
    if (status === "inactive" || role !== "admin") {
      const { count: activeAdminCount } = await supabaseClient
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("condominium_id", adminProfile.condominium_id)
        .eq("role", "admin")
        .eq("status", "active");

      if (
        activeAdminCount === 1 &&
        userId === adminProfile.id &&
        (status === "inactive" || role !== "admin")
      ) {
        return jsonResponse(
          { error: "Cannot deactivate or change role of last admin" },
          400,
        );
      }
    }

    // 1. Update profile first
    const profileUpdate: any = {};
    if (name !== undefined) profileUpdate.name = name;
    if (role !== undefined) profileUpdate.role = role;
    if (email !== undefined) profileUpdate.email = email;
    if (status !== undefined) profileUpdate.status = status;

    if (Object.keys(profileUpdate).length > 0) {
      const { error: updateProfileError } = await supabaseClient
        .from("profiles")
        .update(profileUpdate)
        .eq("id", userId);
      if (updateProfileError) {
        console.error("Error updating profile:", updateProfileError);
        return jsonResponse(
          { error: updateProfileError.message },
          400,
        );
      }
    }

    // 2. Update auth user if email or password are provided
    if (email !== undefined || nextPassword !== undefined) {
      const authUpdate: any = {};
      if (email !== undefined) authUpdate.email = email;
      if (nextPassword !== undefined) authUpdate.password = nextPassword;

      const { error: updateUserError } = await supabaseClient.auth.admin.updateUserById(
        userId,
        authUpdate
      );
      if (updateUserError) {
        console.error("Error updating auth user:", updateUserError);
        return jsonResponse(
          { error: updateUserError.message },
          400,
        );
      }
    }

    // Fetch updated profile to return
    const { data: updatedProfile, error: fetchError } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    // Create an activity log
    const { error: logError } = await supabaseClient
      .from("activity_logs")
      .insert({
        action: "user_updated",
        profile_id: adminProfile.id,
        condominium_id: adminProfile.condominium_id,
      });
    if (logError) {
      console.error("Error creating activity log:", logError);
    }

    return jsonResponse(
      { user: updatedProfile },
      200,
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return jsonResponse(
      { error: "Internal Server Error" },
      500,
    );
  }
});

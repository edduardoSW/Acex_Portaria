// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("Hello from Functions!");

serve(async (req) => {
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
      return new Response(
        JSON.stringify({ error: "Authorization header is required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
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
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get the admin's profile to verify they are an admin and get their condo ID
    const { data: adminProfile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (profileError) {
      console.error("Error getting admin profile:", profileError);
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (adminProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get the request body
    const { userId } = await req.json();

    // Prevent admin from deleting themselves
    if (userId === adminProfile.id) {
      return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get the user's profile to verify they belong to the same condo
    const { data: userProfile, error: userProfileError } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (userProfileError) {
      console.error("Error getting user profile:", userProfileError);
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (userProfile.condominium_id !== adminProfile.condominium_id) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if user has any activity logs or packages - if yes, deactivate instead of deleting
    const { count: packageCount } = await supabaseClient
      .from("packages")
      .select("*", { count: "exact", head: true })
      .or(`registered_by.eq.${userId},delivered_by.eq.${userId}`);

    const { count: logCount } = await supabaseClient
      .from("activity_logs")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", userId);

    if (packageCount && packageCount > 0 || logCount && logCount > 0) {
      // Deactivate instead of deleting
      await supabaseClient
        .from("profiles")
        .update({ status: "inactive" })
        .eq("id", userId);
      // Create an activity log
      await supabaseClient
        .from("activity_logs")
        .insert({
          action: "user_deactivated",
          profile_id: adminProfile.id,
          condominium_id: adminProfile.condominium_id,
        });
    } else {
      // 1. Delete the user from Supabase Auth
      const { error: authError } = await supabaseClient.auth.admin.deleteUser(userId);
      if (authError) {
        console.error("Error deleting auth user:", authError);
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      // 2. Delete profile will cascade (but let's do it anyway)
      await supabaseClient
        .from("profiles")
        .delete()
        .eq("id", userId);

      // Create an activity log
      await supabaseClient
        .from("activity_logs")
        .insert({
          action: "user_deleted",
          profile_id: adminProfile.id,
          condominium_id: adminProfile.condominium_id,
        });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

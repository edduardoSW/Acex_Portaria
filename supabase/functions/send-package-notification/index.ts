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

    // Get the user's profile to verify they are part of a condo
    const { data: userProfile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (profileError) {
      console.error("Error getting user profile:", profileError);
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get the request body
    const { packageId } = await req.json();

    // Get the package with resident and condo info
    const { data: packageData, error: packageError } = await supabaseClient
      .from("packages")
      .select(
        `
        *,
        resident: residents(*),
        condominium: condominiums(*)
        `
      )
      .eq("id", packageId)
      .single();
    if (packageError) {
      console.error("Error getting package:", packageError);
      return new Response(JSON.stringify({ error: "Package not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify the package belongs to the same condo as the user
    if (packageData.condominium_id !== userProfile.condominium_id) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Normalize the phone number
    let phone = packageData.resident.whatsapp.replace(/\D/g, "");
    if (!phone.startsWith("55")) {
      phone = "55" + phone;
    }

    // Format date and time
    const date = new Date(packageData.created_at);
    const formattedDate = date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const formattedTime = date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Build the message
    const firstName = packageData.resident.name.split(" ")[0];
    const message = `Olá, ${firstName}!\n\nUma encomenda destinada à unidade ${packageData.resident.block} - ${packageData.resident.apartment} chegou à portaria do ${packageData.condominium.name}.\n\nRecebida em ${formattedDate} às ${formattedTime}.\n\nPor favor, realize a retirada quando possível.`;

    let whatsappSent = false;
    let whatsappError = null;
    let whatsappMessageId = null;
    let notificationStatus = "failed";

    // Try to send message via Evolution API
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    const evolutionInstance = Deno.env.get("EVOLUTION_INSTANCE");

    if (evolutionUrl && evolutionApiKey && evolutionInstance) {
      try {
        const response = await fetch(
          `${evolutionUrl}/message/sendText/${evolutionInstance}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": evolutionApiKey,
            },
            body: JSON.stringify({
              number: phone,
              options: {
                delay: 1200,
                presence: "composing",
              },
              textMessage: {
                text: message,
              },
            }),
          }
        );

        if (response.ok) {
          const result = await response.json();
          whatsappSent = true;
          whatsappMessageId = result.key?.id || null;
          notificationStatus = "sent";
        } else {
          const errorData = await response.json();
          whatsappError = errorData.message || "Erro ao enviar WhatsApp";
          console.error("Error sending WhatsApp:", whatsappError);
        }
      } catch (error) {
        whatsappError = error instanceof Error ? error.message : "Erro ao enviar WhatsApp";
        console.error("Error sending WhatsApp:", whatsappError);
      }
    } else {
      whatsappError = "Variáveis de ambiente da Evolution API não configuradas";
      console.warn(whatsappError);
    }

    // Update the package with the result
    const { error: updateError } = await supabaseClient
      .from("packages")
      .update({
        whatsapp_sent: whatsappSent,
        whatsapp_error: whatsappError,
        whatsapp_sent_at: whatsappSent ? new Date().toISOString() : null,
        whatsapp_message_id: whatsappMessageId,
        notification_status: notificationStatus,
      })
      .eq("id", packageId);
    if (updateError) {
      console.error("Error updating package:", updateError);
    }

    // Create an activity log
    const { error: logError } = await supabaseClient
      .from("activity_logs")
      .insert({
        action: whatsappSent ? "whatsapp_sent" : "whatsapp_failed",
        profile_id: userProfile.id,
        condominium_id: userProfile.condominium_id,
        package_id: packageId,
      });
    if (logError) {
      console.error("Error creating activity log:", logError);
    }

    return new Response(JSON.stringify({ success: true, sent: whatsappSent, error: whatsappError }), {
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

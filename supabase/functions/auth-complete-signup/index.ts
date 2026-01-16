import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CompleteSignupRequest {
  email: string;
  password: string;
  nickname: string;
  verification_token: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, nickname, verification_token }: CompleteSignupRequest = await req.json();

    // Validate input
    if (!email || !password || !nickname || !verification_token) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate password strength
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the verification token exists and is valid
    const { data: otpRecord, error: otpError } = await supabaseAdmin
      .from("auth_email_otps")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("purpose", "signup")
      .eq("consumed_at", verification_token) // We store the token in consumed_at after verification
      .single();

    if (otpError || !otpRecord) {
      console.error("OTP verification failed:", otpError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired verification. Please request a new code." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if verification token is still valid (within 10 minutes of verification)
    const verifiedAt = new Date(otpRecord.consumed_at);
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    
    if (verifiedAt < tenMinutesAgo) {
      return new Response(
        JSON.stringify({ error: "Verification expired. Please start the signup process again." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (existingUser) {
      return new Response(
        JSON.stringify({ error: "An account with this email already exists" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create user with admin API (email already confirmed, no platform email sent)
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      email_confirm: true, // Mark email as confirmed immediately
      user_metadata: { nickname }
    });

    if (createError) {
      console.error("User creation error:", createError);
      return new Response(
        JSON.stringify({ error: createError.message || "Failed to create account" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!userData.user) {
      return new Response(
        JSON.stringify({ error: "User creation failed" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create leaderboard entry for the new user
    const { error: leaderboardError } = await supabaseAdmin
      .from("leaderboard")
      .insert({
        user_id: userData.user.id,
        nickname: nickname,
        xp: 0,
        level: 1,
        queries_executed: 0,
        tables_created: 0,
        rows_inserted: 0,
        current_streak: 0,
        highest_streak: 0,
        badges: []
      });

    if (leaderboardError) {
      console.error("Leaderboard creation error:", leaderboardError);
      // Don't fail signup if leaderboard creation fails - it can be created later
    }

    // Clean up used OTP record
    await supabaseAdmin
      .from("auth_email_otps")
      .delete()
      .eq("id", otpRecord.id);

    console.log("User created successfully:", userData.user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Account created successfully",
        user_id: userData.user.id 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error in auth-complete-signup:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

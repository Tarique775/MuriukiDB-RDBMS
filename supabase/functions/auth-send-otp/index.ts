import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendOtpRequest {
  email: string;
  purpose: "signup" | "recovery" | "email_change";
}

// Generate a 6-character alphanumeric code
function generateOtpCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars: I,O,0,1
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Simple hash function for OTP codes
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code + Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, purpose }: SendOtpRequest = await req.json();

    if (!email || !purpose) {
      return new Response(
        JSON.stringify({ error: "Email and purpose are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role for backend access
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Rate limit: Check for recent OTP sent to this email
    const { data: recentOtp } = await supabase
      .from("auth_email_otps")
      .select("created_at")
      .eq("email", email.toLowerCase())
      .eq("purpose", purpose)
      .gte("created_at", new Date(Date.now() - 60000).toISOString()) // Last 60 seconds
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentOtp) {
      const waitTime = Math.ceil((new Date(recentOtp.created_at).getTime() + 60000 - Date.now()) / 1000);
      return new Response(
        JSON.stringify({ error: `Please wait ${waitTime} seconds before requesting another code` }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate OTP code
    const otpCode = generateOtpCode();
    const codeHash = await hashCode(otpCode);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

    // Store OTP in database
    const { error: insertError } = await supabase
      .from("auth_email_otps")
      .insert({
        email: email.toLowerCase(),
        purpose,
        code_hash: codeHash,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Failed to store OTP:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate verification code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email via Resend
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    let subject: string;
    let htmlContent: string;

    switch (purpose) {
      case "signup":
        subject = "Confirm your email for MuriukiDB";
        htmlContent = `
          <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #00ff00; padding: 40px; border: 1px solid #00ff00;">
            <h1 style="color: #00ff00; border-bottom: 1px solid #00ff00; padding-bottom: 20px; margin-bottom: 20px;">Confirm your email</h1>
            <p style="color: #ffffff; font-size: 16px; line-height: 1.6;">
              Thanks for signing up for <strong style="color: #00ff00;">MuriukiDB RDBMS</strong> app!
            </p>
            <p style="color: #ffffff; font-size: 16px; line-height: 1.6;">
              Please confirm your email address (<strong style="color: #00ff00;">${email}</strong>) by entering the code below:
            </p>
            <div style="background: #1a1a1a; border: 2px solid #00ff00; padding: 30px; text-align: center; margin: 30px 0;">
              <span style="font-size: 36px; letter-spacing: 8px; color: #00ff00; font-weight: bold;">${otpCode}</span>
            </div>
            <p style="color: #888888; font-size: 12px;">This code expires in 15 minutes.</p>
          </div>
        `;
        break;

      case "recovery":
        subject = "Password recovery code for MuriukiDB";
        htmlContent = `
          <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #00ff00; padding: 40px; border: 1px solid #00ff00;">
            <h1 style="color: #00ff00; border-bottom: 1px solid #00ff00; padding-bottom: 20px; margin-bottom: 20px;">Password Recovery</h1>
            <p style="color: #ffffff; font-size: 16px; line-height: 1.6;">
              You requested to reset your password for <strong style="color: #00ff00;">MuriukiDB RDBMS</strong>.
            </p>
            <p style="color: #ffffff; font-size: 16px; line-height: 1.6;">
              Enter this verification code to continue:
            </p>
            <div style="background: #1a1a1a; border: 2px solid #00ff00; padding: 30px; text-align: center; margin: 30px 0;">
              <span style="font-size: 36px; letter-spacing: 8px; color: #00ff00; font-weight: bold;">${otpCode}</span>
            </div>
            <p style="color: #888888; font-size: 12px;">This code expires in 15 minutes. If you didn't request this, please ignore this email.</p>
          </div>
        `;
        break;

      case "email_change":
        subject = "Confirm your new email for MuriukiDB";
        htmlContent = `
          <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #00ff00; padding: 40px; border: 1px solid #00ff00;">
            <h1 style="color: #00ff00; border-bottom: 1px solid #00ff00; padding-bottom: 20px; margin-bottom: 20px;">Confirm Email Change</h1>
            <p style="color: #ffffff; font-size: 16px; line-height: 1.6;">
              You requested to change your email address for <strong style="color: #00ff00;">MuriukiDB RDBMS</strong>.
            </p>
            <p style="color: #ffffff; font-size: 16px; line-height: 1.6;">
              Enter this verification code to confirm:
            </p>
            <div style="background: #1a1a1a; border: 2px solid #00ff00; padding: 30px; text-align: center; margin: 30px 0;">
              <span style="font-size: 36px; letter-spacing: 8px; color: #00ff00; font-weight: bold;">${otpCode}</span>
            </div>
            <p style="color: #888888; font-size: 12px;">This code expires in 15 minutes.</p>
          </div>
        `;
        break;
    }

    const emailResponse = await resend.emails.send({
      from: "MuriukiDB <onboarding@resend.dev>",
      to: [email],
      subject,
      html: htmlContent,
    });

    // Check for Resend errors and fail properly
    if (emailResponse.error) {
      console.error("Resend API error:", emailResponse.error);
      return new Response(
        JSON.stringify({ 
          error: "Failed to send verification email. Please try again later.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Email sent successfully:", { id: emailResponse.data?.id, email: email.substring(0, 3) + '***' });

    // Cleanup old expired OTPs (fire and forget)
    try {
      await supabase.rpc("cleanup_expired_otps");
    } catch (e) {
      // Ignore cleanup errors
    }

    return new Response(
      JSON.stringify({ success: true, message: "Verification code sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in auth-send-otp:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send verification code" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);

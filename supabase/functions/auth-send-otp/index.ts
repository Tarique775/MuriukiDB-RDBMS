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

    if (purpose === 'signup') {
      subject = "Confirm your email - MuriukiDB";
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', 'Droid Sans Mono', 'Source Code Pro', monospace;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="500" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 40px;">
                  <tr>
                    <td align="center" style="padding-bottom: 24px;">
                      <h1 style="color: #22c55e; font-size: 28px; margin: 0; font-weight: 600;">MuriukiDB</h1>
                      <p style="color: #6b7280; font-size: 14px; margin: 8px 0 0 0;">Welcome to the terminal</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 24px;">
                      <p style="color: #e5e7eb; font-size: 16px; margin: 0 0 16px 0; line-height: 1.6;">Thanks for signing up! Use the verification code below to complete your registration:</p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom: 24px;">
                      <div style="background: #111; border: 2px solid #22c55e; border-radius: 8px; padding: 20px 40px; display: inline-block;">
                        <span style="color: #22c55e; font-size: 32px; font-weight: bold; letter-spacing: 8px;">${otpCode}</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <p style="color: #9ca3af; font-size: 14px; margin: 0; line-height: 1.6;">This code expires in <strong style="color: #22c55e;">15 minutes</strong>.</p>
                      <p style="color: #6b7280; font-size: 13px; margin: 16px 0 0 0;">If you didn't request this code, you can safely ignore this email.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
    } else if (purpose === 'recovery') {
      subject = "Password recovery code - MuriukiDB";
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', 'Droid Sans Mono', 'Source Code Pro', monospace;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="500" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 12px; padding: 40px;">
                  <tr>
                    <td align="center" style="padding-bottom: 24px;">
                      <h1 style="color: #fbbf24; font-size: 28px; margin: 0; font-weight: 600;">MuriukiDB</h1>
                      <p style="color: #6b7280; font-size: 14px; margin: 8px 0 0 0;">Password Recovery</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 24px;">
                      <p style="color: #e5e7eb; font-size: 16px; margin: 0 0 16px 0; line-height: 1.6;">You requested to reset your password. Use the code below to proceed:</p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom: 24px;">
                      <div style="background: #111; border: 2px solid #fbbf24; border-radius: 8px; padding: 20px 40px; display: inline-block;">
                        <span style="color: #fbbf24; font-size: 32px; font-weight: bold; letter-spacing: 8px;">${otpCode}</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <p style="color: #9ca3af; font-size: 14px; margin: 0; line-height: 1.6;">This code expires in <strong style="color: #fbbf24;">15 minutes</strong>.</p>
                      <p style="color: #6b7280; font-size: 13px; margin: 16px 0 0 0;">If you didn't request this, please secure your account immediately.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
    } else {
      subject = "Verify your email change - MuriukiDB";
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', 'Droid Sans Mono', 'Source Code Pro', monospace;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="500" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 12px; padding: 40px;">
                  <tr>
                    <td align="center" style="padding-bottom: 24px;">
                      <h1 style="color: #3b82f6; font-size: 28px; margin: 0; font-weight: 600;">MuriukiDB</h1>
                      <p style="color: #6b7280; font-size: 14px; margin: 8px 0 0 0;">Email Change Verification</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 24px;">
                      <p style="color: #e5e7eb; font-size: 16px; margin: 0 0 16px 0; line-height: 1.6;">Here's your verification code to confirm your new email:</p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom: 24px;">
                      <div style="background: #111; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px 40px; display: inline-block;">
                        <span style="color: #3b82f6; font-size: 32px; font-weight: bold; letter-spacing: 8px;">${otpCode}</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <p style="color: #9ca3af; font-size: 14px; margin: 0; line-height: 1.6;">This code expires in <strong style="color: #3b82f6;">15 minutes</strong>.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
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

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 30; // 30 requests per minute for anonymous
const MAX_REQUESTS_AUTH = 60; // 60 requests per minute for authenticated users
const BACKOFF_MULTIPLIER = 2;
const MAX_BACKOFF_MS = 5 * 60 * 1000; // Max 5 minutes backoff

interface RateLimitEntry {
  id: string;
  identifier: string;
  endpoint: string;
  request_count: number;
  window_start: string;
  last_request: string;
  backoff_until: string | null;
  created_at: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
  backoffLevel?: number;
}

// Use any for supabase client to avoid type issues with edge functions
async function checkRateLimit(
  supabaseAdmin: any,
  identifier: string,
  isAuthenticated: boolean
): Promise<RateLimitResult> {
  const now = new Date();
  const maxRequests = isAuthenticated ? MAX_REQUESTS_AUTH : MAX_REQUESTS_PER_WINDOW;
  const endpoint = "sql-execute";

  try {
    // Get current rate limit entry
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("rate_limits")
      .select("*")
      .eq("identifier", identifier)
      .eq("endpoint", endpoint)
      .maybeSingle();

    if (fetchError) {
      console.error("Rate limit fetch error:", fetchError);
      return { allowed: true, remaining: maxRequests - 1 };
    }

    const entry = existing as RateLimitEntry | null;

    // Check if there's an active backoff
    if (entry?.backoff_until) {
      const backoffUntil = new Date(entry.backoff_until);
      if (now < backoffUntil) {
        const retryAfter = Math.ceil((backoffUntil.getTime() - now.getTime()) / 1000);
        return { 
          allowed: false, 
          remaining: 0, 
          retryAfter,
          backoffLevel: Math.ceil(Math.log2(retryAfter / 60)) + 1
        };
      }
    }

    if (entry) {
      const windowStart = new Date(entry.window_start);
      const windowAge = now.getTime() - windowStart.getTime();

      // Check if we're in the same window
      if (windowAge < RATE_LIMIT_WINDOW_MS) {
        if (entry.request_count >= maxRequests) {
          // Calculate backoff time based on how many times they've exceeded
          const consecutiveExceeds = Math.min(entry.request_count - maxRequests + 1, 10);
          const backoffMs = Math.min(
            RATE_LIMIT_WINDOW_MS * Math.pow(BACKOFF_MULTIPLIER, consecutiveExceeds - 1),
            MAX_BACKOFF_MS
          );
          const backoffUntil = new Date(now.getTime() + backoffMs);

          // Update with backoff
          await supabaseAdmin
            .from("rate_limits")
            .update({
              request_count: entry.request_count + 1,
              last_request: now.toISOString(),
              backoff_until: backoffUntil.toISOString(),
            })
            .eq("id", entry.id);

          return { 
            allowed: false, 
            remaining: 0, 
            retryAfter: Math.ceil(backoffMs / 1000),
            backoffLevel: consecutiveExceeds
          };
        }

        // Increment request count
        await supabaseAdmin
          .from("rate_limits")
          .update({
            request_count: entry.request_count + 1,
            last_request: now.toISOString(),
          })
          .eq("id", entry.id);

        return { 
          allowed: true, 
          remaining: maxRequests - entry.request_count - 1 
        };
      } else {
        // New window - reset counter
        await supabaseAdmin
          .from("rate_limits")
          .update({
            request_count: 1,
            window_start: now.toISOString(),
            last_request: now.toISOString(),
            backoff_until: null,
          })
          .eq("id", entry.id);

        return { allowed: true, remaining: maxRequests - 1 };
      }
    } else {
      // Create new rate limit entry
      await supabaseAdmin
        .from("rate_limits")
        .insert({
          identifier,
          endpoint,
          request_count: 1,
          window_start: now.toISOString(),
          last_request: now.toISOString(),
        });

      return { allowed: true, remaining: maxRequests - 1 };
    }
  } catch (error) {
    console.error("Rate limit error:", error);
    return { allowed: true, remaining: maxRequests - 1 };
  }
}

async function recordActivity(
  supabaseAdmin: any,
  userId: string
): Promise<void> {
  try {
    await supabaseAdmin.rpc("record_query_activity", { p_user_id: userId });
  } catch (error) {
    console.error("Activity recording error:", error);
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create admin client for rate limiting
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;
    let isAuthenticated = false;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      
      const { data: { user }, error } = await userClient.auth.getUser();
      if (!error && user) {
        userId = user.id;
        isAuthenticated = true;
      }
    }

    // Get client IP for rate limiting (fallback identifier)
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
      || req.headers.get("cf-connecting-ip")
      || req.headers.get("x-real-ip")
      || "unknown";

    const identifier = userId || clientIP;

    // Check rate limit
    const rateLimitResult = await checkRateLimit(supabaseAdmin, identifier, isAuthenticated);

    if (!rateLimitResult.allowed) {
      const backoffMessage = rateLimitResult.backoffLevel && rateLimitResult.backoffLevel > 1
        ? ` Exponential backoff level ${rateLimitResult.backoffLevel} applied.`
        : "";

      console.log(`Rate limit exceeded for ${identifier}. Retry after ${rateLimitResult.retryAfter}s.${backoffMessage}`);

      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          message: `Too many requests. Please wait ${rateLimitResult.retryAfter} seconds before trying again.${backoffMessage}`,
          retryAfter: rateLimitResult.retryAfter,
          backoffLevel: rateLimitResult.backoffLevel,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(rateLimitResult.retryAfter),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // Record activity for authenticated users
    if (userId) {
      await recordActivity(supabaseAdmin, userId);
    }

    // Return success with rate limit info
    const body = await req.json().catch(() => ({}));
    
    console.log(`Request allowed for ${identifier}. Remaining: ${rateLimitResult.remaining}`);

    return new Response(
      JSON.stringify({
        success: true,
        remaining: rateLimitResult.remaining,
        message: "Request allowed",
        query: body.query,
        userId: userId,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": String(rateLimitResult.remaining),
        },
      }
    );
  } catch (error) {
    console.error("SQL execute error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
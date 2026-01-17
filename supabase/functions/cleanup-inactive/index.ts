import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Restricted CORS - only for internal/cron calls
const corsHeaders = {
  "Access-Control-Allow-Origin": "",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting configuration
const CLEANUP_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour window
const MAX_CLEANUP_REQUESTS = 1; // 1 request per hour max

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

interface RateLimitEntry {
  id: string;
  identifier: string;
  endpoint: string;
  request_count: number;
  window_start: string;
  last_request: string;
}

async function checkCleanupRateLimit(supabase: any): Promise<RateLimitResult> {
  const now = new Date();
  const endpoint = "cleanup-inactive";
  const identifier = "cleanup-cron"; // Fixed identifier for this endpoint

  try {
    // Check existing rate limit entry
    const { data: existing } = await supabase
      .from("rate_limits")
      .select("*")
      .eq("identifier", identifier)
      .eq("endpoint", endpoint)
      .maybeSingle() as { data: RateLimitEntry | null };

    if (existing) {
      const windowStart = new Date(existing.window_start);
      const windowAge = now.getTime() - windowStart.getTime();

      if (windowAge < CLEANUP_RATE_LIMIT_WINDOW_MS) {
        // Still within rate limit window
        if (existing.request_count >= MAX_CLEANUP_REQUESTS) {
          const retryAfter = Math.ceil((CLEANUP_RATE_LIMIT_WINDOW_MS - windowAge) / 1000);
          console.log(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
          return { allowed: false, retryAfter };
        }
        // Increment request count
        await supabase
          .from("rate_limits")
          .update({
            request_count: existing.request_count + 1,
            last_request: now.toISOString(),
          })
          .eq("id", existing.id);
      } else {
        // Window expired, reset
        await supabase
          .from("rate_limits")
          .update({
            request_count: 1,
            window_start: now.toISOString(),
            last_request: now.toISOString(),
          })
          .eq("id", existing.id);
      }
    } else {
      // Create new rate limit entry
      await supabase.from("rate_limits").insert({
        identifier,
        endpoint,
        request_count: 1,
        window_start: now.toISOString(),
        last_request: now.toISOString(),
      });
    }

    return { allowed: true };
  } catch (error) {
    console.error("Rate limit check error:", error);
    // Allow request on rate limit check failure (fail open for cron jobs)
    return { allowed: true };
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight - reject external requests
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Authentication: Require secret token for cleanup operations
    const authHeader = req.headers.get("authorization");
    const expectedToken = Deno.env.get("CLEANUP_SECRET");
    
    // If CLEANUP_SECRET is set, require it; otherwise allow internal Supabase cron calls
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      console.error("Unauthorized cleanup attempt");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check rate limit
    const rateLimitResult = await checkCleanupRateLimit(supabase);
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Rate limit exceeded",
          retryAfter: rateLimitResult.retryAfter,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(rateLimitResult.retryAfter),
          },
        }
      );
    }

    // Run the cleanup function
    const { error } = await supabase.rpc("cleanup_inactive_users");

    if (error) {
      console.error("Cleanup error:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Cleanup completed successfully at", new Date().toISOString());

    return new Response(
      JSON.stringify({
        success: true,
        message: "Cleanup completed successfully",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Cleanup function error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
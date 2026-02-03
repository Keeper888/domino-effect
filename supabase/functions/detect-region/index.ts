// Gift Giver - Region Detection Edge Function
// Detects user's region based on IP geolocation

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Country to region mapping
const countryToRegion: Record<string, string> = {
  // UK
  GB: "UK",
  UK: "UK",

  // US
  US: "US",

  // Italy
  IT: "IT",

  // Map other European countries to IT (EUR region)
  DE: "IT",
  FR: "IT",
  ES: "IT",
  NL: "IT",
  BE: "IT",
  AT: "IT",
  PT: "IT",
  IE: "UK", // Ireland closer to UK

  // Default to UK for unmapped countries
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get country from Cloudflare headers (if behind Cloudflare)
    const cfCountry = req.headers.get("cf-ipcountry");

    // Get country from Supabase edge function headers
    const xCountry = req.headers.get("x-country");

    // Get from Vercel/Netlify headers
    const vercelCountry = req.headers.get("x-vercel-ip-country");

    // Determine country code
    const countryCode = cfCountry || xCountry || vercelCountry || "GB";

    // Map to our supported regions
    const region = countryToRegion[countryCode.toUpperCase()] || "UK";

    // Get additional info from headers
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] ||
                     req.headers.get("x-real-ip") ||
                     "unknown";

    // Response with region info
    const response = {
      region,
      country_code: countryCode.toUpperCase(),
      detected_from: cfCountry ? "cloudflare" :
                     xCountry ? "supabase" :
                     vercelCountry ? "vercel" : "default",
      timestamp: new Date().toISOString(),
    };

    console.log(`[detect-region] IP: ${clientIp.substring(0, 10)}... → Country: ${countryCode} → Region: ${region}`);

    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600" // Cache for 1 hour
      },
    });

  } catch (error) {
    console.error("[detect-region] Error:", error);

    return new Response(
      JSON.stringify({
        region: "UK",
        error: "Detection failed, using default",
        timestamp: new Date().toISOString()
      }),
      {
        status: 200, // Still return 200 with default
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Gift Giver - Gift Recommendation Edge Function
// Uses OCEAN psychology matching to recommend gifts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PsychologyProfile {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  mbti_type?: string;
}

interface RecommendRequest {
  persona_id?: string;
  psychology?: PsychologyProfile;
  interests?: string[];
  budget?: string;
  region?: string;
  occasion?: string;
  limit?: number;
  offset?: number;
}

// Budget ranges in GBP
const budgetRanges: Record<string, { min: number; max: number }> = {
  "under25": { min: 0, max: 25 },
  "25-50": { min: 25, max: 50 },
  "50-100": { min: 50, max: 100 },
  "100-200": { min: 100, max: 200 },
  "200plus": { min: 200, max: 9999 },
};

// Calculate psychology match score between persona and product
function calculatePsychologyScore(
  persona: PsychologyProfile,
  product: {
    openness_affinity: number;
    conscientiousness_affinity: number;
    extraversion_affinity: number;
    agreeableness_affinity: number;
    neuroticism_affinity: number;
    mbti_compatible?: string[];
  }
): number {
  let score = 0;

  // OCEAN matching (each trait contributes up to 20 points)
  // Affinity is -100 to +100, persona score is 0-100
  // Positive affinity + high persona = good match
  // Negative affinity + low persona = good match

  const traits = [
    { persona: persona.openness, affinity: product.openness_affinity },
    { persona: persona.conscientiousness, affinity: product.conscientiousness_affinity },
    { persona: persona.extraversion, affinity: product.extraversion_affinity },
    { persona: persona.agreeableness, affinity: product.agreeableness_affinity },
    { persona: persona.neuroticism, affinity: product.neuroticism_affinity },
  ];

  for (const trait of traits) {
    // Normalize persona score to -50 to +50 range
    const normalizedPersona = trait.persona - 50;

    // Calculate match: both positive = good, both negative = good
    const match = (normalizedPersona * trait.affinity) / 5000; // -1 to +1

    // Convert to 0-20 score
    score += (match + 1) * 10;
  }

  // MBTI bonus (up to 20 extra points)
  if (persona.mbti_type && product.mbti_compatible?.includes(persona.mbti_type)) {
    score += 20;
  }

  return Math.round(score);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: RecommendRequest = await req.json();
    const {
      persona_id,
      psychology,
      interests = [],
      budget = "50-100",
      region = "UK",
      occasion,
      limit = 20,
      offset = 0,
    } = body;

    let personaPsychology = psychology;

    // If persona_id provided, fetch psychology profile
    if (persona_id && !personaPsychology) {
      const { data: persona } = await supabase
        .from("persona_psychology")
        .select("*")
        .eq("persona_id", persona_id)
        .single();

      if (persona) {
        personaPsychology = persona;
      }
    }

    // Build base query
    let query = supabase
      .from("products")
      .select(`
        *,
        product_regions!inner(local_price, affiliate_link, in_stock, region_code),
        product_psychology(*),
        product_tags(tag:tags(name, slug, tag_type))
      `)
      .eq("status", "active")
      .eq("link_status", "active")
      .eq("product_regions.region_code", region)
      .eq("product_regions.in_stock", true);

    // Apply budget filter
    const budgetRange = budgetRanges[budget] || budgetRanges["50-100"];
    query = query
      .gte("product_regions.local_price", budgetRange.min)
      .lte("product_regions.local_price", budgetRange.max);

    // Execute query
    const { data: products, error } = await query.limit(100); // Get more for scoring

    if (error) {
      throw error;
    }

    // Score and sort products
    let scoredProducts = (products || []).map((product) => {
      let score = 50; // Base score

      // Psychology scoring
      if (personaPsychology && product.product_psychology) {
        score += calculatePsychologyScore(personaPsychology, product.product_psychology);
      }

      // Interest matching (10 points per matching tag)
      if (interests.length > 0 && product.product_tags) {
        const productTags = product.product_tags.map((pt: any) => pt.tag?.slug);
        for (const interest of interests) {
          if (productTags.includes(interest)) {
            score += 10;
          }
        }
      }

      // Occasion matching (15 points)
      if (occasion && product.product_psychology?.best_for_occasions?.includes(occasion)) {
        score += 15;
      }

      // Popularity bonus (up to 10 points)
      score += Math.min(product.popularity_score || 0, 10);

      return {
        ...product,
        match_score: score,
        price: product.product_regions[0]?.local_price,
        affiliate_link: product.product_regions[0]?.affiliate_link,
      };
    });

    // Sort by score descending
    scoredProducts.sort((a, b) => b.match_score - a.match_score);

    // Apply pagination
    const paginatedProducts = scoredProducts.slice(offset, offset + limit);

    // Clean up response
    const response = {
      products: paginatedProducts.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.short_description || p.description,
        price: p.price,
        image_url: p.image_url,
        affiliate_link: p.affiliate_link,
        match_score: p.match_score,
        tags: p.product_tags?.map((pt: any) => pt.tag?.name).filter(Boolean),
        retailer: p.retailer,
      })),
      total: scoredProducts.length,
      has_more: offset + limit < scoredProducts.length,
      region,
      budget,
    };

    console.log(`[recommend-gifts] Returned ${paginatedProducts.length} products for region ${region}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[recommend-gifts] Error:", error);

    return new Response(
      JSON.stringify({
        error: error.message,
        products: [],
        total: 0,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

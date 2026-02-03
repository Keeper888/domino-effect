// ============================================================================
// CLICK TRACKER EDGE FUNCTION
// Handles affiliate link clicks with real-time validation
// ============================================================================
//
// Flow:
// 1. User clicks affiliate link on frontend
// 2. Frontend calls this function with product_id
// 3. Function logs click, validates link, returns redirect URL
// 4. Frontend redirects user to affiliate URL
//
// This is a REDIRECT-THROUGH-BACKEND approach which:
// - Avoids CORS issues (validation happens server-side)
// - Enables accurate click tracking
// - Allows real-time broken link detection
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ClickRequest {
  product_id: string
  session_id?: string
  referrer?: string
}

interface ValidationResult {
  is_healthy: boolean
  http_status?: number
  error_type?: string
  error_message?: string
  response_time_ms: number
  is_soft_404?: boolean
  soft_404_indicators?: Record<string, unknown>
}

// Parse User-Agent for device info
function parseUserAgent(ua: string): { device_type: string; browser: string; os: string } {
  const device_type = /mobile/i.test(ua) ? 'mobile'
    : /tablet|ipad/i.test(ua) ? 'tablet'
    : /windows|macintosh|linux/i.test(ua) ? 'desktop'
    : 'unknown'

  const browser = /firefox/i.test(ua) ? 'Firefox'
    : /edg/i.test(ua) ? 'Edge'
    : /chrome/i.test(ua) ? 'Chrome'
    : /safari/i.test(ua) ? 'Safari'
    : 'Other'

  const os = /windows/i.test(ua) ? 'Windows'
    : /macintosh|mac os/i.test(ua) ? 'macOS'
    : /linux/i.test(ua) ? 'Linux'
    : /android/i.test(ua) ? 'Android'
    : /iphone|ipad/i.test(ua) ? 'iOS'
    : 'Other'

  return { device_type, browser, os }
}

// Simple hash function for IP privacy
async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(ip + Deno.env.get('IP_SALT') || 'default-salt')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Quick link validation (lightweight check)
async function quickValidateLink(url: string, timeoutMs = 5000): Promise<ValidationResult> {
  const startTime = Date.now()

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(url, {
      method: 'HEAD', // Use HEAD for faster response
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GiftGiverBot/1.0; +https://giftgiver.app/bot)',
      }
    })

    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime

    // Check for hard 404
    if (response.status === 404) {
      return {
        is_healthy: false,
        http_status: 404,
        error_type: 'http_error',
        error_message: 'Page not found (404)',
        response_time_ms: responseTime,
      }
    }

    // Check for server errors
    if (response.status >= 500) {
      return {
        is_healthy: false,
        http_status: response.status,
        error_type: 'http_error',
        error_message: `Server error (${response.status})`,
        response_time_ms: responseTime,
      }
    }

    // Check for other client errors (except 403 which might be bot blocking)
    if (response.status >= 400 && response.status !== 403) {
      return {
        is_healthy: false,
        http_status: response.status,
        error_type: 'http_error',
        error_message: `HTTP error (${response.status})`,
        response_time_ms: responseTime,
      }
    }

    return {
      is_healthy: true,
      http_status: response.status,
      response_time_ms: responseTime,
    }

  } catch (error) {
    const responseTime = Date.now() - startTime

    if (error.name === 'AbortError') {
      return {
        is_healthy: false,
        error_type: 'timeout',
        error_message: `Request timed out after ${timeoutMs}ms`,
        response_time_ms: responseTime,
      }
    }

    if (error.message?.includes('dns') || error.message?.includes('getaddrinfo')) {
      return {
        is_healthy: false,
        error_type: 'dns_error',
        error_message: 'Domain could not be resolved',
        response_time_ms: responseTime,
      }
    }

    if (error.message?.includes('certificate') || error.message?.includes('SSL')) {
      return {
        is_healthy: false,
        error_type: 'ssl_error',
        error_message: 'SSL certificate error',
        response_time_ms: responseTime,
      }
    }

    return {
      is_healthy: false,
      error_type: 'network_error',
      error_message: error.message || 'Unknown network error',
      response_time_ms: responseTime,
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: ClickRequest = await req.json()
    const { product_id, session_id, referrer } = body

    if (!product_id) {
      return new Response(
        JSON.stringify({ error: 'product_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get product with affiliate URL
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, affiliate_url, name, link_status')
      .eq('id', product_id)
      .single()

    if (productError || !product) {
      return new Response(
        JSON.stringify({ error: 'Product not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!product.affiliate_url) {
      return new Response(
        JSON.stringify({ error: 'Product has no affiliate URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Warn if product is already flagged
    const isProductFlagged = product.link_status === 'flagged'

    // Parse request metadata
    const userAgent = req.headers.get('user-agent') || ''
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'
    const { device_type, browser, os } = parseUserAgent(userAgent)
    const ipHash = await hashIP(clientIP)

    // Quick validate the link (non-blocking for user experience)
    // We use a short timeout to not delay the redirect too much
    const validation = await quickValidateLink(product.affiliate_url, 3000)

    // Log click analytics
    const clickData = {
      product_id,
      affiliate_url: product.affiliate_url,
      session_id,
      user_agent: userAgent,
      ip_hash: ipHash,
      referrer: referrer || req.headers.get('referer'),
      device_type,
      browser,
      os,
      http_status: validation.http_status,
      response_time_ms: validation.response_time_ms,
      is_healthy: validation.is_healthy,
      error_type: validation.error_type,
      error_message: validation.error_message,
      validated_at: new Date().toISOString(),
    }

    // Insert click analytics (fire and forget - don't block response)
    supabase.from('click_analytics').insert(clickData).then(({ error }) => {
      if (error) console.error('Failed to log click:', error)
    })

    // Update link health status
    supabase.rpc('update_link_health', {
      p_product_id: product_id,
      p_affiliate_url: product.affiliate_url,
      p_is_healthy: validation.is_healthy,
      p_http_status: validation.http_status,
      p_error_type: validation.error_type,
      p_error_message: validation.error_message,
      p_response_time_ms: validation.response_time_ms,
    }).then(({ error }) => {
      if (error) console.error('Failed to update link health:', error)
    })

    // Return response with redirect URL
    return new Response(
      JSON.stringify({
        success: true,
        redirect_url: product.affiliate_url,
        is_healthy: validation.is_healthy,
        warning: !validation.is_healthy ? 'This link may be broken' : undefined,
        product_flagged: isProductFlagged,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Click tracker error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

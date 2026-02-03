// ============================================================================
// LINK VALIDATOR EDGE FUNCTION (Background Job)
// Periodically validates all affiliate links
// ============================================================================
//
// Deployment: Run via Supabase cron (pg_cron) or external scheduler
//
// Schedule recommendations:
// - Every 6 hours for active products
// - Every 24 hours for full scan
//
// This function:
// 1. Gets batch of products needing validation
// 2. Validates each link (with soft-404 detection)
// 3. Updates health status
// 4. Auto-flags products exceeding failure threshold
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ValidationRequest {
  hours_since_check?: number  // Default: 24
  batch_size?: number         // Default: 50
  include_soft_404?: boolean  // Default: true
}

interface Soft404Pattern {
  domain_pattern: string
  page_title_patterns: string[]
  body_text_patterns: string[]
}

interface ValidationResult {
  product_id: string
  affiliate_url: string
  is_healthy: boolean
  http_status?: number
  error_type?: string
  error_message?: string
  response_time_ms: number
  is_soft_404: boolean
  soft_404_indicators?: Record<string, unknown>
}

// Check if URL matches domain pattern
function matchesDomain(url: string, pattern: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    // Convert SQL LIKE pattern to regex
    const regexPattern = pattern
      .replace(/%/g, '.*')
      .replace(/_/g, '.')
    return new RegExp(regexPattern, 'i').test(hostname)
  } catch {
    return false
  }
}

// Full link validation with soft-404 detection
async function validateLink(
  url: string,
  soft404Patterns: Soft404Pattern[],
  timeoutMs = 10000
): Promise<ValidationResult> {
  const startTime = Date.now()

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    // Use GET instead of HEAD to get body for soft-404 detection
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    })

    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime

    // Check for hard errors
    if (response.status === 404) {
      return {
        product_id: '',
        affiliate_url: url,
        is_healthy: false,
        http_status: 404,
        error_type: 'http_error',
        error_message: 'Page not found (404)',
        response_time_ms: responseTime,
        is_soft_404: false,
      }
    }

    if (response.status >= 500) {
      return {
        product_id: '',
        affiliate_url: url,
        is_healthy: false,
        http_status: response.status,
        error_type: 'http_error',
        error_message: `Server error (${response.status})`,
        response_time_ms: responseTime,
        is_soft_404: false,
      }
    }

    if (response.status >= 400 && response.status !== 403) {
      return {
        product_id: '',
        affiliate_url: url,
        is_healthy: false,
        http_status: response.status,
        error_type: 'http_error',
        error_message: `HTTP error (${response.status})`,
        response_time_ms: responseTime,
        is_soft_404: false,
      }
    }

    // Get response body for soft-404 detection
    const body = await response.text()
    const bodyLower = body.toLowerCase()

    // Find matching soft-404 patterns for this domain
    const matchingPatterns = soft404Patterns.filter(p => matchesDomain(url, p.domain_pattern))

    // Check for soft-404 indicators
    const soft404Indicators: Record<string, string[]> = {
      matched_title_patterns: [],
      matched_body_patterns: [],
    }

    for (const pattern of matchingPatterns) {
      // Check title patterns
      const titleMatch = body.match(/<title[^>]*>([^<]*)<\/title>/i)
      const pageTitle = titleMatch ? titleMatch[1].toLowerCase() : ''

      for (const titlePattern of pattern.page_title_patterns || []) {
        if (pageTitle.includes(titlePattern.toLowerCase())) {
          soft404Indicators.matched_title_patterns.push(titlePattern)
        }
      }

      // Check body patterns
      for (const bodyPattern of pattern.body_text_patterns || []) {
        if (bodyLower.includes(bodyPattern.toLowerCase())) {
          soft404Indicators.matched_body_patterns.push(bodyPattern)
        }
      }
    }

    // Check generic soft-404 indicators
    const genericIndicators = [
      'page not found',
      'product not found',
      'item not available',
      'no longer available',
      'out of stock',
      'discontinued',
      'this item is unavailable',
      'sorry, this product',
      'we couldn\'t find',
      'does not exist',
    ]

    for (const indicator of genericIndicators) {
      if (bodyLower.includes(indicator)) {
        soft404Indicators.matched_body_patterns.push(indicator)
      }
    }

    // Determine if it's a soft-404
    const isSoft404 =
      soft404Indicators.matched_title_patterns.length > 0 ||
      soft404Indicators.matched_body_patterns.length >= 2

    if (isSoft404) {
      return {
        product_id: '',
        affiliate_url: url,
        is_healthy: false,
        http_status: response.status,
        error_type: 'soft_404',
        error_message: 'Product appears to be unavailable (soft 404)',
        response_time_ms: responseTime,
        is_soft_404: true,
        soft_404_indicators: soft404Indicators,
      }
    }

    return {
      product_id: '',
      affiliate_url: url,
      is_healthy: true,
      http_status: response.status,
      response_time_ms: responseTime,
      is_soft_404: false,
    }

  } catch (error) {
    const responseTime = Date.now() - startTime

    if (error.name === 'AbortError') {
      return {
        product_id: '',
        affiliate_url: url,
        is_healthy: false,
        error_type: 'timeout',
        error_message: `Request timed out after ${timeoutMs}ms`,
        response_time_ms: responseTime,
        is_soft_404: false,
      }
    }

    if (error.message?.includes('dns') || error.message?.includes('getaddrinfo')) {
      return {
        product_id: '',
        affiliate_url: url,
        is_healthy: false,
        error_type: 'dns_error',
        error_message: 'Domain could not be resolved',
        response_time_ms: responseTime,
        is_soft_404: false,
      }
    }

    if (error.message?.includes('certificate') || error.message?.includes('SSL')) {
      return {
        product_id: '',
        affiliate_url: url,
        is_healthy: false,
        error_type: 'ssl_error',
        error_message: 'SSL certificate error',
        response_time_ms: responseTime,
        is_soft_404: false,
      }
    }

    return {
      product_id: '',
      affiliate_url: url,
      is_healthy: false,
      error_type: 'network_error',
      error_message: error.message || 'Unknown network error',
      response_time_ms: responseTime,
      is_soft_404: false,
    }
  }
}

// Process batch with concurrency control
async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency = 5
): Promise<R[]> {
  const results: R[] = []

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(processor))
    results.push(...batchResults)

    // Small delay between batches to avoid rate limiting
    if (i + concurrency < items.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return results
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Parse request (or use defaults)
    let params: ValidationRequest = {
      hours_since_check: 24,
      batch_size: 50,
      include_soft_404: true,
    }

    if (req.method === 'POST') {
      try {
        const body = await req.json()
        params = { ...params, ...body }
      } catch {
        // Use defaults if body parsing fails
      }
    }

    // Verify authorization (require service role or cron secret)
    const authHeader = req.headers.get('authorization')
    const cronSecret = Deno.env.get('CRON_SECRET')

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Also check for service role key
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (!authHeader?.includes(serviceRoleKey || '')) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get products needing validation
    const { data: products, error: productsError } = await supabase
      .rpc('get_products_for_validation', {
        p_hours_since_check: params.hours_since_check,
        p_limit: params.batch_size,
      })

    if (productsError) {
      throw new Error(`Failed to get products: ${productsError.message}`)
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No products need validation',
          validated: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get soft-404 patterns
    let soft404Patterns: Soft404Pattern[] = []
    if (params.include_soft_404) {
      const { data: patterns } = await supabase
        .from('soft_404_patterns')
        .select('domain_pattern, page_title_patterns, body_text_patterns')
        .eq('is_active', true)

      soft404Patterns = patterns || []
    }

    // Validate links with concurrency control
    const results = await processBatch(
      products,
      async (product) => {
        const result = await validateLink(product.affiliate_url, soft404Patterns)
        result.product_id = product.product_id
        return result
      },
      5 // 5 concurrent requests
    )

    // Update health status for each result
    const updatePromises = results.map(async (result) => {
      // Log validation
      await supabase.from('link_validation_log').insert({
        product_id: result.product_id,
        affiliate_url: result.affiliate_url,
        validation_type: 'scheduled',
        http_status: result.http_status,
        response_time_ms: result.response_time_ms,
        is_healthy: result.is_healthy,
        error_type: result.error_type,
        error_message: result.error_message,
        soft_404_check: result.soft_404_indicators,
      })

      // Update health status
      await supabase.rpc('update_link_health', {
        p_product_id: result.product_id,
        p_affiliate_url: result.affiliate_url,
        p_is_healthy: result.is_healthy,
        p_http_status: result.http_status,
        p_error_type: result.error_type,
        p_error_message: result.error_message,
        p_response_time_ms: result.response_time_ms,
        p_soft_404_indicators: result.soft_404_indicators,
      })
    })

    await Promise.all(updatePromises)

    // Summarize results
    const summary = {
      total_validated: results.length,
      healthy: results.filter(r => r.is_healthy).length,
      unhealthy: results.filter(r => !r.is_healthy).length,
      soft_404: results.filter(r => r.is_soft_404).length,
      errors_by_type: results
        .filter(r => !r.is_healthy)
        .reduce((acc, r) => {
          const type = r.error_type || 'unknown'
          acc[type] = (acc[type] || 0) + 1
          return acc
        }, {} as Record<string, number>),
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        details: results.map(r => ({
          product_id: r.product_id,
          is_healthy: r.is_healthy,
          error_type: r.error_type,
          http_status: r.http_status,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Link validation error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

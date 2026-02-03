-- ============================================================================
-- AFFILIATE LINK VALIDATION CRON JOBS
-- Requires pg_cron extension (available in Supabase Pro plans)
-- ============================================================================
--
-- Note: pg_cron is only available on Pro plans and above.
-- For free plans, use an external scheduler (GitHub Actions, cron job, etc.)
-- to call the validate-links Edge Function periodically.
--
-- Alternative: Use Supabase's built-in pg_net extension to call Edge Functions
-- ============================================================================

-- Enable pg_cron if not already enabled (Pro plan only)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- OPTION 1: Using pg_cron (Pro plan)
-- ============================================================================

-- Schedule link validation every 6 hours
-- SELECT cron.schedule(
--     'validate-affiliate-links',      -- job name
--     '0 */6 * * *',                   -- every 6 hours
--     $$
--     SELECT net.http_post(
--         url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/validate-links',
--         headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
--         body := '{"hours_since_check": 6, "batch_size": 100}'::jsonb
--     );
--     $$
-- );

-- Schedule daily cleanup of old validation logs (keep 90 days)
-- SELECT cron.schedule(
--     'cleanup-validation-logs',
--     '0 3 * * *',                     -- daily at 3 AM
--     $$
--     DELETE FROM link_validation_log
--     WHERE validated_at < NOW() - INTERVAL '90 days';
--     $$
-- );

-- ============================================================================
-- OPTION 2: Using pg_net directly (callable from triggers or functions)
-- ============================================================================

-- Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to trigger link validation via Edge Function
CREATE OR REPLACE FUNCTION trigger_link_validation(
    p_hours_since_check INTEGER DEFAULT 24,
    p_batch_size INTEGER DEFAULT 100
) RETURNS BIGINT AS $$
DECLARE
    v_request_id BIGINT;
BEGIN
    SELECT net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/validate-links',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
            'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
            'hours_since_check', p_hours_since_check,
            'batch_size', p_batch_size
        )
    ) INTO v_request_id;

    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- OPTION 3: Manual validation trigger (for testing or on-demand)
-- ============================================================================

-- Function to manually validate a specific product
CREATE OR REPLACE FUNCTION manual_validate_product(p_product_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_product RECORD;
    v_result JSONB;
BEGIN
    -- Get product
    SELECT id, affiliate_url INTO v_product
    FROM products
    WHERE id = p_product_id;

    IF v_product IS NULL THEN
        RETURN jsonb_build_object('error', 'Product not found');
    END IF;

    -- Note: Full HTTP validation requires Edge Function
    -- This function just marks the product for priority validation

    UPDATE link_health_status
    SET last_checked_at = NULL,  -- Force re-check
        updated_at = NOW()
    WHERE product_id = p_product_id;

    -- If no health status exists, create one
    INSERT INTO link_health_status (product_id, affiliate_url, current_status)
    VALUES (p_product_id, v_product.affiliate_url, 'unknown')
    ON CONFLICT (product_id) DO NOTHING;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Product queued for validation',
        'product_id', p_product_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CLEANUP FUNCTIONS
-- ============================================================================

-- Function to clean up old validation logs
CREATE OR REPLACE FUNCTION cleanup_old_validation_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM link_validation_log
    WHERE validated_at < NOW() - (days_to_keep || ' days')::INTERVAL;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old click analytics (aggregate first, then delete)
CREATE OR REPLACE FUNCTION cleanup_old_click_analytics(days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    -- Note: In production, you'd want to aggregate old data into a summary table
    -- before deleting the raw data

    DELETE FROM click_analytics
    WHERE clicked_at < NOW() - (days_to_keep || ' days')::INTERVAL;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ANALYTICS FUNCTIONS
-- ============================================================================

-- Get click statistics for a time period
CREATE OR REPLACE FUNCTION get_click_stats(
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE (
    total_clicks BIGINT,
    successful_clicks BIGINT,
    failed_clicks BIGINT,
    unique_products BIGINT,
    avg_response_time_ms NUMERIC,
    top_error_type TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_clicks,
        COUNT(*) FILTER (WHERE is_healthy = true)::BIGINT as successful_clicks,
        COUNT(*) FILTER (WHERE is_healthy = false)::BIGINT as failed_clicks,
        COUNT(DISTINCT product_id)::BIGINT as unique_products,
        ROUND(AVG(response_time_ms)::NUMERIC, 2) as avg_response_time_ms,
        MODE() WITHIN GROUP (ORDER BY error_type) FILTER (WHERE error_type IS NOT NULL) as top_error_type
    FROM click_analytics
    WHERE clicked_at BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get products with most click failures
CREATE OR REPLACE FUNCTION get_most_failing_products(
    p_limit INTEGER DEFAULT 10,
    p_days INTEGER DEFAULT 7
) RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    total_clicks BIGINT,
    failed_clicks BIGINT,
    failure_rate NUMERIC,
    last_error TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ca.product_id,
        p.name as product_name,
        COUNT(*)::BIGINT as total_clicks,
        COUNT(*) FILTER (WHERE ca.is_healthy = false)::BIGINT as failed_clicks,
        ROUND(
            (COUNT(*) FILTER (WHERE ca.is_healthy = false)::NUMERIC / COUNT(*)::NUMERIC) * 100,
            2
        ) as failure_rate,
        (
            SELECT error_message
            FROM click_analytics
            WHERE product_id = ca.product_id AND error_message IS NOT NULL
            ORDER BY clicked_at DESC
            LIMIT 1
        ) as last_error
    FROM click_analytics ca
    JOIN products p ON p.id = ca.product_id
    WHERE ca.clicked_at > NOW() - (p_days || ' days')::INTERVAL
    GROUP BY ca.product_id, p.name
    HAVING COUNT(*) FILTER (WHERE ca.is_healthy = false) > 0
    ORDER BY failed_clicks DESC, failure_rate DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- AFFILIATE LINK HEALTH SYSTEM
-- Migration: 20260203_affiliate_link_health.sql
-- Purpose: Track clicks, detect broken links, manage flagged products
-- ============================================================================

-- ============================================================================
-- 1. CLICK ANALYTICS TABLE
-- Tracks every click with full context for analytics
-- ============================================================================
CREATE TABLE IF NOT EXISTS click_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What was clicked
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    affiliate_url TEXT NOT NULL,

    -- Who clicked (anonymous tracking)
    session_id TEXT,                    -- Anonymous session identifier
    user_agent TEXT,
    ip_hash TEXT,                       -- Hashed IP for privacy (never store raw IP)
    referrer TEXT,

    -- Geographic context (from IP geolocation)
    country_code CHAR(2),
    region TEXT,

    -- Device context
    device_type TEXT CHECK (device_type IN ('mobile', 'tablet', 'desktop', 'unknown')),
    browser TEXT,
    os TEXT,

    -- Link health at click time
    http_status INTEGER,                -- Response code (200, 404, 500, etc.)
    response_time_ms INTEGER,           -- How long the check took
    is_healthy BOOLEAN DEFAULT true,
    error_type TEXT,                    -- 'timeout', 'dns_error', 'ssl_error', 'http_error', 'soft_404'
    error_message TEXT,

    -- Timestamps
    clicked_at TIMESTAMPTZ DEFAULT NOW(),
    validated_at TIMESTAMPTZ,           -- When we checked the link

    -- Indexes for analytics queries
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast analytics queries
CREATE INDEX idx_click_analytics_product ON click_analytics(product_id);
CREATE INDEX idx_click_analytics_clicked_at ON click_analytics(clicked_at DESC);
CREATE INDEX idx_click_analytics_healthy ON click_analytics(is_healthy) WHERE is_healthy = false;
CREATE INDEX idx_click_analytics_product_date ON click_analytics(product_id, clicked_at DESC);

-- ============================================================================
-- 2. LINK HEALTH STATUS TABLE
-- Current health status of each product's affiliate link
-- ============================================================================
CREATE TABLE IF NOT EXISTS link_health_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Current link being tracked
    affiliate_url TEXT NOT NULL,

    -- Health metrics
    current_status TEXT DEFAULT 'unknown' CHECK (current_status IN (
        'healthy',          -- 200 OK, product available
        'unhealthy',        -- Hard 404 or error
        'soft_404',         -- Page loads but product unavailable
        'timeout',          -- Request timed out
        'unknown'           -- Not yet checked
    )),

    -- Failure tracking
    consecutive_failures INTEGER DEFAULT 0,
    failure_threshold INTEGER DEFAULT 3,  -- Auto-flag after this many failures
    last_http_status INTEGER,
    last_error_type TEXT,
    last_error_message TEXT,

    -- Soft-404 detection
    soft_404_indicators JSONB,          -- What triggered soft-404 detection

    -- Timestamps
    last_checked_at TIMESTAMPTZ,
    last_healthy_at TIMESTAMPTZ,
    first_failure_at TIMESTAMPTZ,
    flagged_at TIMESTAMPTZ,             -- When it was auto-flagged

    -- Stats
    total_checks INTEGER DEFAULT 0,
    total_failures INTEGER DEFAULT 0,
    uptime_percentage DECIMAL(5,2),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(product_id)
);

CREATE INDEX idx_link_health_status ON link_health_status(current_status);
CREATE INDEX idx_link_health_product ON link_health_status(product_id);
CREATE INDEX idx_link_health_failures ON link_health_status(consecutive_failures DESC);

-- ============================================================================
-- 3. NEEDS FIX QUEUE TABLE
-- Products flagged for admin review
-- ============================================================================
CREATE TABLE IF NOT EXISTS products_needs_fix (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Original product data snapshot (in case product table is modified)
    product_snapshot JSONB NOT NULL,

    -- Why it was flagged
    flagged_reason TEXT NOT NULL CHECK (flagged_reason IN (
        'consecutive_failures',     -- Hit failure threshold
        'hard_404',                 -- Direct 404 response
        'soft_404',                 -- Page loads but product unavailable
        'timeout',                  -- Consistent timeouts
        'ssl_error',                -- Certificate issues
        'dns_error',                -- Domain doesn't resolve
        'manual_flag',              -- Admin flagged it
        'user_report'               -- User reported broken link
    )),

    -- Detection details
    last_http_status INTEGER,
    last_error_message TEXT,
    detection_details JSONB,        -- Full context of what was detected

    -- Admin workflow
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',          -- Awaiting review
        'in_review',        -- Admin is looking at it
        'fixed',            -- Link was updated and verified
        'replaced',         -- Product replaced with alternative
        'removed',          -- Product permanently removed
        'false_positive'    -- Was actually working, restored
    )),

    -- Resolution tracking
    assigned_to UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    new_affiliate_url TEXT,         -- Updated URL if fixed

    -- Timestamps
    flagged_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,

    -- Audit
    created_by TEXT DEFAULT 'system',
    resolved_by UUID REFERENCES auth.users(id),

    UNIQUE(product_id)
);

CREATE INDEX idx_needs_fix_status ON products_needs_fix(status);
CREATE INDEX idx_needs_fix_reason ON products_needs_fix(flagged_reason);
CREATE INDEX idx_needs_fix_flagged ON products_needs_fix(flagged_at DESC);

-- ============================================================================
-- 4. LINK VALIDATION LOG TABLE
-- Historical log of all validation attempts (for debugging)
-- ============================================================================
CREATE TABLE IF NOT EXISTS link_validation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    affiliate_url TEXT NOT NULL,

    -- Validation result
    validation_type TEXT CHECK (validation_type IN ('click', 'scheduled', 'manual')),
    http_status INTEGER,
    response_time_ms INTEGER,
    is_healthy BOOLEAN,

    -- Error details
    error_type TEXT,
    error_message TEXT,

    -- Soft-404 detection results
    soft_404_check JSONB,

    -- Raw response data (for debugging, limited)
    response_headers JSONB,
    response_body_preview TEXT,     -- First 500 chars for soft-404 analysis

    validated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partition by month for easy cleanup of old logs
CREATE INDEX idx_validation_log_product ON link_validation_log(product_id);
CREATE INDEX idx_validation_log_date ON link_validation_log(validated_at DESC);

-- Auto-cleanup: keep only 90 days of validation logs
-- (Implement via pg_cron or scheduled function)

-- ============================================================================
-- 5. SOFT-404 PATTERNS TABLE
-- Configurable patterns for detecting soft-404s by retailer
-- ============================================================================
CREATE TABLE IF NOT EXISTS soft_404_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Which retailer/domain this applies to
    domain_pattern TEXT NOT NULL,       -- e.g., 'amazon.com', '%.amazon.%'
    retailer_name TEXT,

    -- Detection patterns (any match = soft-404)
    page_title_patterns TEXT[],         -- ["Page Not Found", "Item Unavailable"]
    body_text_patterns TEXT[],          -- ["This item is no longer available"]
    url_redirect_patterns TEXT[],       -- Redirect URL patterns that indicate 404
    html_element_selectors TEXT[],      -- CSS selectors that indicate unavailable

    -- Additional checks
    check_price_present BOOLEAN DEFAULT false,
    check_add_to_cart_present BOOLEAN DEFAULT false,
    min_content_length INTEGER,         -- Pages shorter than this = soft-404

    -- Status
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default patterns for common retailers
INSERT INTO soft_404_patterns (domain_pattern, retailer_name, page_title_patterns, body_text_patterns) VALUES
    ('amazon.com', 'Amazon US',
     ARRAY['Page Not Found', 'Sorry', 'Dogs of Amazon'],
     ARRAY['looking for something', 'is no longer available', 'Currently unavailable']),
    ('amazon.co.uk', 'Amazon UK',
     ARRAY['Page Not Found', 'Sorry'],
     ARRAY['is no longer available', 'Currently unavailable']),
    ('etsy.com', 'Etsy',
     ARRAY['Page Not Found', 'Oops'],
     ARRAY['This item is unavailable', 'no longer available', 'shop is on vacation']),
    ('ebay.com', 'eBay',
     ARRAY['Page Not Found'],
     ARRAY['This listing was ended', 'This item is out of stock', 'no longer available'])
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. ADD STATUS COLUMN TO PRODUCTS TABLE
-- ============================================================================
DO $$
BEGIN
    -- Add link_status column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'link_status'
    ) THEN
        ALTER TABLE products ADD COLUMN link_status TEXT DEFAULT 'active'
            CHECK (link_status IN ('active', 'flagged', 'disabled', 'pending_review'));
    END IF;

    -- Add last_validated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'last_validated_at'
    ) THEN
        ALTER TABLE products ADD COLUMN last_validated_at TIMESTAMPTZ;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_link_status ON products(link_status);

-- ============================================================================
-- 7. FUNCTIONS
-- ============================================================================

-- Function to flag a product and move to needs_fix queue
CREATE OR REPLACE FUNCTION flag_broken_product(
    p_product_id UUID,
    p_reason TEXT,
    p_http_status INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_detection_details JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_product_snapshot JSONB;
    v_needs_fix_id UUID;
BEGIN
    -- Get product snapshot
    SELECT to_jsonb(p.*) INTO v_product_snapshot
    FROM products p WHERE p.id = p_product_id;

    IF v_product_snapshot IS NULL THEN
        RAISE EXCEPTION 'Product not found: %', p_product_id;
    END IF;

    -- Update product status
    UPDATE products
    SET link_status = 'flagged'
    WHERE id = p_product_id;

    -- Insert into needs_fix queue (upsert)
    INSERT INTO products_needs_fix (
        product_id,
        product_snapshot,
        flagged_reason,
        last_http_status,
        last_error_message,
        detection_details
    ) VALUES (
        p_product_id,
        v_product_snapshot,
        p_reason,
        p_http_status,
        p_error_message,
        p_detection_details
    )
    ON CONFLICT (product_id) DO UPDATE SET
        product_snapshot = EXCLUDED.product_snapshot,
        flagged_reason = EXCLUDED.flagged_reason,
        last_http_status = EXCLUDED.last_http_status,
        last_error_message = EXCLUDED.last_error_message,
        detection_details = EXCLUDED.detection_details,
        flagged_at = NOW(),
        status = 'pending'
    RETURNING id INTO v_needs_fix_id;

    -- Update link health status
    UPDATE link_health_status
    SET flagged_at = NOW(),
        updated_at = NOW()
    WHERE product_id = p_product_id;

    RETURN v_needs_fix_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to restore a false-positive flagged product
CREATE OR REPLACE FUNCTION restore_flagged_product(
    p_product_id UUID,
    p_admin_id UUID,
    p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    -- Update needs_fix record
    UPDATE products_needs_fix
    SET status = 'false_positive',
        resolved_at = NOW(),
        resolved_by = p_admin_id,
        resolution_notes = p_notes
    WHERE product_id = p_product_id AND status IN ('pending', 'in_review');

    -- Restore product status
    UPDATE products
    SET link_status = 'active'
    WHERE id = p_product_id;

    -- Reset health status
    UPDATE link_health_status
    SET current_status = 'healthy',
        consecutive_failures = 0,
        flagged_at = NULL,
        last_healthy_at = NOW(),
        first_failure_at = NULL,
        updated_at = NOW()
    WHERE product_id = p_product_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update link health after validation
CREATE OR REPLACE FUNCTION update_link_health(
    p_product_id UUID,
    p_affiliate_url TEXT,
    p_is_healthy BOOLEAN,
    p_http_status INTEGER DEFAULT NULL,
    p_error_type TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_response_time_ms INTEGER DEFAULT NULL,
    p_soft_404_indicators JSONB DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_current_failures INTEGER;
    v_threshold INTEGER;
BEGIN
    -- Upsert link health status
    INSERT INTO link_health_status (
        product_id,
        affiliate_url,
        current_status,
        consecutive_failures,
        last_http_status,
        last_error_type,
        last_error_message,
        soft_404_indicators,
        last_checked_at,
        last_healthy_at,
        first_failure_at,
        total_checks,
        total_failures
    ) VALUES (
        p_product_id,
        p_affiliate_url,
        CASE
            WHEN p_is_healthy THEN 'healthy'
            WHEN p_error_type = 'soft_404' THEN 'soft_404'
            WHEN p_error_type = 'timeout' THEN 'timeout'
            ELSE 'unhealthy'
        END,
        CASE WHEN p_is_healthy THEN 0 ELSE 1 END,
        p_http_status,
        p_error_type,
        p_error_message,
        p_soft_404_indicators,
        NOW(),
        CASE WHEN p_is_healthy THEN NOW() ELSE NULL END,
        CASE WHEN NOT p_is_healthy THEN NOW() ELSE NULL END,
        1,
        CASE WHEN p_is_healthy THEN 0 ELSE 1 END
    )
    ON CONFLICT (product_id) DO UPDATE SET
        affiliate_url = EXCLUDED.affiliate_url,
        current_status = CASE
            WHEN p_is_healthy THEN 'healthy'
            WHEN p_error_type = 'soft_404' THEN 'soft_404'
            WHEN p_error_type = 'timeout' THEN 'timeout'
            ELSE 'unhealthy'
        END,
        consecutive_failures = CASE
            WHEN p_is_healthy THEN 0
            ELSE link_health_status.consecutive_failures + 1
        END,
        last_http_status = p_http_status,
        last_error_type = CASE WHEN p_is_healthy THEN NULL ELSE p_error_type END,
        last_error_message = CASE WHEN p_is_healthy THEN NULL ELSE p_error_message END,
        soft_404_indicators = CASE WHEN p_error_type = 'soft_404' THEN p_soft_404_indicators ELSE NULL END,
        last_checked_at = NOW(),
        last_healthy_at = CASE WHEN p_is_healthy THEN NOW() ELSE link_health_status.last_healthy_at END,
        first_failure_at = CASE
            WHEN p_is_healthy THEN NULL
            WHEN link_health_status.first_failure_at IS NULL THEN NOW()
            ELSE link_health_status.first_failure_at
        END,
        total_checks = link_health_status.total_checks + 1,
        total_failures = link_health_status.total_failures + CASE WHEN p_is_healthy THEN 0 ELSE 1 END,
        updated_at = NOW();

    -- Check if we need to auto-flag
    SELECT consecutive_failures, failure_threshold
    INTO v_current_failures, v_threshold
    FROM link_health_status
    WHERE product_id = p_product_id;

    IF v_current_failures >= v_threshold THEN
        PERFORM flag_broken_product(
            p_product_id,
            'consecutive_failures',
            p_http_status,
            p_error_message,
            jsonb_build_object(
                'consecutive_failures', v_current_failures,
                'threshold', v_threshold,
                'last_error_type', p_error_type
            )
        );
    END IF;

    -- Update product's last_validated_at
    UPDATE products
    SET last_validated_at = NOW()
    WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get products needing validation (not checked in X hours)
CREATE OR REPLACE FUNCTION get_products_for_validation(
    p_hours_since_check INTEGER DEFAULT 24,
    p_limit INTEGER DEFAULT 100
) RETURNS TABLE (
    product_id UUID,
    affiliate_url TEXT,
    retailer TEXT,
    priority INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.affiliate_url,
        p.retailer,
        -- Priority: never checked > unhealthy > oldest checked
        CASE
            WHEN lhs.last_checked_at IS NULL THEN 1
            WHEN lhs.current_status = 'unhealthy' THEN 2
            ELSE 3
        END as priority
    FROM products p
    LEFT JOIN link_health_status lhs ON p.id = lhs.product_id
    WHERE p.link_status = 'active'
      AND p.affiliate_url IS NOT NULL
      AND (
          lhs.last_checked_at IS NULL
          OR lhs.last_checked_at < NOW() - (p_hours_since_check || ' hours')::INTERVAL
      )
    ORDER BY priority, lhs.last_checked_at NULLS FIRST
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================================

-- Click analytics: anyone can insert, only admins can read
ALTER TABLE click_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert click analytics"
    ON click_analytics FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admins can read click analytics"
    ON click_analytics FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.uid() = id
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Link health status: public read, system write
ALTER TABLE link_health_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read link health"
    ON link_health_status FOR SELECT
    USING (true);

-- Needs fix queue: admins only
ALTER TABLE products_needs_fix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage needs_fix"
    ON products_needs_fix FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.uid() = id
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Validation log: admins only
ALTER TABLE link_validation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read validation logs"
    ON link_validation_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.uid() = id
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- ============================================================================
-- 9. VIEWS FOR ANALYTICS
-- ============================================================================

-- Dashboard view: Link health summary
CREATE OR REPLACE VIEW v_link_health_summary AS
SELECT
    current_status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM link_health_status
GROUP BY current_status;

-- Dashboard view: Recent flagged products
CREATE OR REPLACE VIEW v_recent_flagged_products AS
SELECT
    nf.id,
    nf.product_id,
    nf.product_snapshot->>'name' as product_name,
    nf.product_snapshot->>'affiliate_url' as original_url,
    nf.flagged_reason,
    nf.last_http_status,
    nf.status,
    nf.flagged_at,
    nf.assigned_to
FROM products_needs_fix nf
WHERE nf.status IN ('pending', 'in_review')
ORDER BY nf.flagged_at DESC;

-- Dashboard view: Click analytics by product (last 30 days)
CREATE OR REPLACE VIEW v_product_click_stats AS
SELECT
    product_id,
    COUNT(*) as total_clicks,
    COUNT(*) FILTER (WHERE is_healthy = true) as successful_clicks,
    COUNT(*) FILTER (WHERE is_healthy = false) as failed_clicks,
    ROUND(AVG(response_time_ms)) as avg_response_time_ms,
    MIN(clicked_at) as first_click,
    MAX(clicked_at) as last_click
FROM click_analytics
WHERE clicked_at > NOW() - INTERVAL '30 days'
GROUP BY product_id;

-- Grant access to views
GRANT SELECT ON v_link_health_summary TO authenticated;
GRANT SELECT ON v_recent_flagged_products TO authenticated;
GRANT SELECT ON v_product_click_stats TO authenticated;

-- ============================================================================
-- 10. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE click_analytics IS 'Tracks all affiliate link clicks with health status at click time';
COMMENT ON TABLE link_health_status IS 'Current health status of each product affiliate link';
COMMENT ON TABLE products_needs_fix IS 'Queue of products with broken links awaiting admin review';
COMMENT ON TABLE link_validation_log IS 'Historical log of all link validation attempts';
COMMENT ON TABLE soft_404_patterns IS 'Configurable patterns for detecting soft-404 by retailer';

COMMENT ON FUNCTION flag_broken_product IS 'Flags a product as broken and adds to needs_fix queue';
COMMENT ON FUNCTION restore_flagged_product IS 'Restores a false-positive flagged product';
COMMENT ON FUNCTION update_link_health IS 'Updates link health status after validation check';
COMMENT ON FUNCTION get_products_for_validation IS 'Gets products that need link validation';

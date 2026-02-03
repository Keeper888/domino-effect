-- ============================================================================
-- GIFT GIVER - REGIONS & AFFILIATES
-- Migration: 003_regions_affiliates.sql
-- Purpose: Multi-region support, affiliate programs, and click tracking
-- ============================================================================

-- ============================================================================
-- 1. REGIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS regions (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    currency TEXT NOT NULL,
    currency_symbol TEXT NOT NULL,
    locale TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0
);

-- Seed regions
INSERT INTO regions (code, name, currency, currency_symbol, locale, sort_order) VALUES
    ('UK', 'United Kingdom', 'GBP', '£', 'en-GB', 1),
    ('US', 'United States', 'USD', '$', 'en-US', 2),
    ('IT', 'Italy', 'EUR', '€', 'it-IT', 3)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    currency = EXCLUDED.currency,
    currency_symbol = EXCLUDED.currency_symbol,
    locale = EXCLUDED.locale;

-- ============================================================================
-- 2. AFFILIATE PROGRAMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS affiliate_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Program info
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,

    -- Tracking configuration
    base_url TEXT NOT NULL,
    tracking_param TEXT NOT NULL,
    tracking_value TEXT,  -- Our affiliate ID

    -- Additional params (for complex tracking)
    extra_params JSONB,

    -- Regional support
    supports_regions TEXT[] NOT NULL,

    -- Commission info
    commission_rate DECIMAL(5,2),
    cookie_duration_days INT,

    -- Status
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_affiliate_programs_slug ON affiliate_programs(slug);
CREATE INDEX idx_affiliate_programs_regions ON affiliate_programs USING GIN (supports_regions);

-- Seed affiliate programs
INSERT INTO affiliate_programs (name, slug, base_url, tracking_param, supports_regions, commission_rate) VALUES
    ('Amazon UK', 'amazon-uk', 'https://www.amazon.co.uk', 'tag', ARRAY['UK'], 4.00),
    ('Amazon US', 'amazon-us', 'https://www.amazon.com', 'tag', ARRAY['US'], 4.00),
    ('Amazon IT', 'amazon-it', 'https://www.amazon.it', 'tag', ARRAY['IT'], 4.00),
    ('eBay', 'ebay', 'https://www.ebay.com', 'mkcid', ARRAY['UK', 'US', 'IT'], 3.00),
    ('Zalando', 'zalando', 'https://www.zalando.co.uk', 'affiliate', ARRAY['UK', 'IT'], 7.00),
    ('ASOS', 'asos', 'https://www.asos.com', 'affid', ARRAY['UK', 'US'], 5.00),
    ('AliExpress', 'aliexpress', 'https://www.aliexpress.com', 'aff_id', ARRAY['UK', 'US', 'IT'], 8.00),
    ('Etsy', 'etsy', 'https://www.etsy.com', 'ref', ARRAY['UK', 'US', 'IT'], 4.00),
    ('Not On The High Street', 'notonthehighstreet', 'https://www.notonthehighstreet.com', 'affiliate', ARRAY['UK'], 6.00),
    ('John Lewis', 'john-lewis', 'https://www.johnlewis.com', 'affid', ARRAY['UK'], 5.00)
ON CONFLICT (slug) DO UPDATE SET
    base_url = EXCLUDED.base_url,
    tracking_param = EXCLUDED.tracking_param,
    supports_regions = EXCLUDED.supports_regions,
    commission_rate = EXCLUDED.commission_rate;

-- ============================================================================
-- 3. PRODUCT REGIONAL AVAILABILITY
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    region_code TEXT NOT NULL REFERENCES regions(code),
    affiliate_program_id UUID REFERENCES affiliate_programs(id),

    -- Regional pricing
    local_price DECIMAL(10,2) NOT NULL,
    original_price DECIMAL(10,2),  -- Before discount
    discount_percent INT,

    -- Affiliate link (pre-built with tracking)
    affiliate_link TEXT NOT NULL,

    -- Availability
    in_stock BOOLEAN DEFAULT true,
    stock_quantity INT,
    shipping_info TEXT,

    -- Link health
    last_checked TIMESTAMPTZ DEFAULT NOW(),
    is_link_healthy BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(product_id, region_code, affiliate_program_id)
);

CREATE INDEX idx_product_regions_product ON product_regions(product_id);
CREATE INDEX idx_product_regions_region ON product_regions(region_code);
CREATE INDEX idx_product_regions_affiliate ON product_regions(affiliate_program_id);
CREATE INDEX idx_product_regions_price ON product_regions(local_price);
CREATE INDEX idx_product_regions_stock ON product_regions(in_stock);

CREATE TRIGGER update_product_regions_updated_at
    BEFORE UPDATE ON product_regions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. AFFILIATE CLICKS TRACKING
-- ============================================================================
CREATE TABLE IF NOT EXISTS affiliate_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What was clicked
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_region_id UUID REFERENCES product_regions(id) ON DELETE SET NULL,
    affiliate_program_id UUID REFERENCES affiliate_programs(id) ON DELETE SET NULL,

    -- Who clicked
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    session_id UUID REFERENCES discovery_sessions(id) ON DELETE SET NULL,

    -- Context
    region_code TEXT,
    clicked_url TEXT NOT NULL,
    referrer_url TEXT,

    -- Device info (anonymized)
    device_type TEXT CHECK (device_type IN ('mobile', 'tablet', 'desktop', 'unknown')),
    browser TEXT,
    country_code CHAR(2),

    -- Link health at click time
    http_status INT,
    response_time_ms INT,
    is_healthy BOOLEAN DEFAULT true,

    clicked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_affiliate_clicks_product ON affiliate_clicks(product_id);
CREATE INDEX idx_affiliate_clicks_user ON affiliate_clicks(user_id);
CREATE INDEX idx_affiliate_clicks_clicked ON affiliate_clicks(clicked_at DESC);
CREATE INDEX idx_affiliate_clicks_region ON affiliate_clicks(region_code);
CREATE INDEX idx_affiliate_clicks_program ON affiliate_clicks(affiliate_program_id);

-- ============================================================================
-- 5. CURRENCY EXCHANGE RATES (for price conversion)
-- ============================================================================
CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate DECIMAL(10,6) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(from_currency, to_currency)
);

-- Seed exchange rates (approximate, should be updated regularly)
INSERT INTO exchange_rates (from_currency, to_currency, rate) VALUES
    ('GBP', 'USD', 1.27),
    ('GBP', 'EUR', 1.17),
    ('USD', 'GBP', 0.79),
    ('USD', 'EUR', 0.92),
    ('EUR', 'GBP', 0.85),
    ('EUR', 'USD', 1.09)
ON CONFLICT (from_currency, to_currency) DO UPDATE SET
    rate = EXCLUDED.rate,
    updated_at = NOW();

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================

-- Regions: public read
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regions are publicly readable"
    ON regions FOR SELECT
    USING (is_active = true);

-- Affiliate programs: public read
ALTER TABLE affiliate_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliate programs are publicly readable"
    ON affiliate_programs FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage affiliate programs"
    ON affiliate_programs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.uid() = id
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Product regions: public read
ALTER TABLE product_regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Product regions are publicly readable"
    ON product_regions FOR SELECT
    USING (in_stock = true AND is_link_healthy = true);

CREATE POLICY "Admins can manage product regions"
    ON product_regions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.uid() = id
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Affiliate clicks: insert for all, read for admins
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert clicks"
    ON affiliate_clicks FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admins can read clicks"
    ON affiliate_clicks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.uid() = id
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Exchange rates: public read
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exchange rates are publicly readable"
    ON exchange_rates FOR SELECT
    USING (true);

-- ============================================================================
-- 7. FUNCTIONS
-- ============================================================================

-- Function to convert price between currencies
CREATE OR REPLACE FUNCTION convert_price(
    amount DECIMAL,
    from_curr TEXT,
    to_curr TEXT
) RETURNS DECIMAL AS $$
DECLARE
    rate DECIMAL;
BEGIN
    IF from_curr = to_curr THEN
        RETURN amount;
    END IF;

    SELECT er.rate INTO rate
    FROM exchange_rates er
    WHERE er.from_currency = from_curr AND er.to_currency = to_curr;

    IF rate IS NULL THEN
        RETURN amount;  -- Return original if no rate found
    END IF;

    RETURN ROUND(amount * rate, 2);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get best price for a product in a region
CREATE OR REPLACE FUNCTION get_best_product_price(
    p_product_id UUID,
    p_region_code TEXT
) RETURNS TABLE (
    price DECIMAL,
    affiliate_link TEXT,
    affiliate_program TEXT,
    in_stock BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pr.local_price,
        pr.affiliate_link,
        ap.name,
        pr.in_stock
    FROM product_regions pr
    JOIN affiliate_programs ap ON pr.affiliate_program_id = ap.id
    WHERE pr.product_id = p_product_id
      AND pr.region_code = p_region_code
      AND pr.in_stock = true
      AND pr.is_link_healthy = true
    ORDER BY pr.local_price ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 8. VIEWS
-- ============================================================================

-- View: Products with regional pricing
CREATE OR REPLACE VIEW v_products_with_pricing AS
SELECT
    p.*,
    pr.region_code,
    pr.local_price,
    pr.original_price,
    pr.discount_percent,
    pr.affiliate_link,
    pr.in_stock,
    ap.name as affiliate_program,
    r.currency,
    r.currency_symbol
FROM products p
JOIN product_regions pr ON p.id = pr.product_id
JOIN regions r ON pr.region_code = r.code
LEFT JOIN affiliate_programs ap ON pr.affiliate_program_id = ap.id
WHERE p.status = 'active'
  AND p.link_status = 'active'
  AND pr.in_stock = true
  AND pr.is_link_healthy = true;

-- View: Click analytics summary
CREATE OR REPLACE VIEW v_click_analytics AS
SELECT
    DATE_TRUNC('day', clicked_at) as click_date,
    region_code,
    COUNT(*) as total_clicks,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT product_id) as unique_products,
    AVG(response_time_ms) as avg_response_time,
    SUM(CASE WHEN is_healthy THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 as health_rate
FROM affiliate_clicks
WHERE clicked_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', clicked_at), region_code
ORDER BY click_date DESC;

-- Grant access to views
GRANT SELECT ON v_products_with_pricing TO authenticated, anon;
GRANT SELECT ON v_click_analytics TO authenticated;

-- ============================================================================
-- 9. COMMENTS
-- ============================================================================
COMMENT ON TABLE regions IS 'Supported regions with currency settings';
COMMENT ON TABLE affiliate_programs IS 'Affiliate program configurations';
COMMENT ON TABLE product_regions IS 'Product availability and pricing by region';
COMMENT ON TABLE affiliate_clicks IS 'Tracking of affiliate link clicks';
COMMENT ON TABLE exchange_rates IS 'Currency exchange rates for price conversion';
COMMENT ON FUNCTION convert_price IS 'Convert amount between currencies';
COMMENT ON FUNCTION get_best_product_price IS 'Get cheapest available price for a product in a region';

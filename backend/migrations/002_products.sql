-- ============================================================================
-- GIFT GIVER - PRODUCTS & CATALOG
-- Migration: 002_products.sql
-- Purpose: Product catalog with categories, tags, and psychology mapping
-- ============================================================================

-- ============================================================================
-- 1. CATEGORIES (3-level hierarchy max)
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    level INT DEFAULT 0 CHECK (level BETWEEN 0 AND 2),
    icon TEXT,
    image_url TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_level ON categories(level);

-- ============================================================================
-- 2. TAGS (flexible niche tagging)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    tag_type TEXT NOT NULL CHECK (tag_type IN (
        'niche',        -- Pokemon Collector, Lego Enthusiast
        'occasion',     -- Birthday, Christmas, Valentine's
        'trait',        -- Minimalist, Tech Lover
        'demographic',  -- For Her, For Him, For Kids
        'price_point',  -- Budget, Mid-Range, Luxury
        'style'         -- Cozy, Modern, Vintage
    )),
    description TEXT,
    icon TEXT,
    color TEXT,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tags_slug ON tags(slug);
CREATE INDEX idx_tags_type ON tags(tag_type);

-- ============================================================================
-- 3. PRODUCTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Basic info
    name TEXT NOT NULL,
    description TEXT,
    short_description TEXT,

    -- Categorization
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,

    -- Pricing (base price in GBP for reference)
    base_price_gbp DECIMAL(10,2) NOT NULL,

    -- Media
    image_url TEXT,
    image_urls TEXT[],  -- Multiple images
    video_url TEXT,

    -- Source tracking
    retailer TEXT,
    affiliate_url TEXT,
    original_url TEXT,

    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN (
        'active', 'inactive', 'out_of_stock', 'discontinued', 'pending_review'
    )),
    link_status TEXT DEFAULT 'active' CHECK (link_status IN (
        'active', 'flagged', 'disabled', 'pending_review'
    )),

    -- Metadata
    sku TEXT,
    brand TEXT,
    popularity_score INT DEFAULT 0,
    last_validated_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_link_status ON products(link_status);
CREATE INDEX idx_products_retailer ON products(retailer);
CREATE INDEX idx_products_price ON products(base_price_gbp);
CREATE INDEX idx_products_popularity ON products(popularity_score DESC);

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. PRODUCT TAGS (many-to-many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_tags (
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    relevance_score INT DEFAULT 100 CHECK (relevance_score BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (product_id, tag_id)
);

CREATE INDEX idx_product_tags_product ON product_tags(product_id);
CREATE INDEX idx_product_tags_tag ON product_tags(tag_id);

-- ============================================================================
-- 5. PRODUCT PSYCHOLOGY MAPPING
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_psychology (
    product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,

    -- OCEAN affinity scores (-100 to +100)
    -- Positive = appeals to high scorers, Negative = appeals to low scorers
    openness_affinity INT DEFAULT 0 CHECK (openness_affinity BETWEEN -100 AND 100),
    conscientiousness_affinity INT DEFAULT 0 CHECK (conscientiousness_affinity BETWEEN -100 AND 100),
    extraversion_affinity INT DEFAULT 0 CHECK (extraversion_affinity BETWEEN -100 AND 100),
    agreeableness_affinity INT DEFAULT 0 CHECK (agreeableness_affinity BETWEEN -100 AND 100),
    neuroticism_affinity INT DEFAULT 0 CHECK (neuroticism_affinity BETWEEN -100 AND 100),

    -- MBTI compatibility (array of compatible types)
    mbti_compatible TEXT[],

    -- Gift context
    best_for_relationships TEXT[],  -- partner, friend, family, etc.
    best_for_occasions TEXT[],      -- birthday, christmas, etc.

    -- Confidence in mapping
    mapping_confidence INT DEFAULT 50,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_product_psychology_updated_at
    BEFORE UPDATE ON product_psychology
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================

-- Categories: public read
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are publicly readable"
    ON categories FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage categories"
    ON categories FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.uid() = id
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Tags: public read
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tags are publicly readable"
    ON tags FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage tags"
    ON tags FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.uid() = id
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Products: public read for active products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active products are publicly readable"
    ON products FOR SELECT
    USING (status = 'active' AND link_status = 'active');

CREATE POLICY "Admins can manage products"
    ON products FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.uid() = id
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Product tags: public read
ALTER TABLE product_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Product tags are publicly readable"
    ON product_tags FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage product tags"
    ON product_tags FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.uid() = id
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Product psychology: public read
ALTER TABLE product_psychology ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Product psychology is publicly readable"
    ON product_psychology FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage product psychology"
    ON product_psychology FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.uid() = id
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- ============================================================================
-- 7. SEED DATA - CATEGORIES
-- ============================================================================
INSERT INTO categories (name, slug, description, level, icon, sort_order) VALUES
    ('For Her', 'for-her', 'Gifts perfect for women', 0, '👩', 1),
    ('For Him', 'for-him', 'Gifts perfect for men', 0, '👨', 2),
    ('For Kids', 'for-kids', 'Gifts for children', 0, '👶', 3),
    ('For Home', 'for-home', 'Home and living gifts', 0, '🏠', 4),
    ('Tech & Gadgets', 'tech-gadgets', 'Technology and gadgets', 0, '📱', 5),
    ('Experiences', 'experiences', 'Experience-based gifts', 0, '🎟️', 6),
    ('Fashion', 'fashion', 'Clothing and accessories', 0, '👗', 7),
    ('Self-Care', 'self-care', 'Wellness and self-care', 0, '🧘', 8)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 8. SEED DATA - TAGS
-- ============================================================================
INSERT INTO tags (name, slug, tag_type, icon, is_featured) VALUES
    -- Niche tags
    ('Pokemon Collector', 'pokemon-collector', 'niche', '⚡', true),
    ('Lego Enthusiast', 'lego-enthusiast', 'niche', '🧱', true),
    ('Hacker/Security', 'hacker-security', 'niche', '💻', false),
    ('IoT Maker', 'iot-maker', 'niche', '🔧', false),
    ('Motorcycle Lover', 'motorcycle-lover', 'niche', '🏍️', false),
    ('Plant Parent', 'plant-parent', 'niche', '🌱', true),
    ('Vinyl Collector', 'vinyl-collector', 'niche', '💿', false),
    ('Anime Fan', 'anime-fan', 'niche', '🎌', true),
    ('Bookworm', 'bookworm', 'niche', '📚', true),
    ('Coffee Addict', 'coffee-addict', 'niche', '☕', true),
    ('Wine Lover', 'wine-lover', 'niche', '🍷', false),
    ('Gamer', 'gamer', 'niche', '🎮', true),
    ('Fitness Buff', 'fitness-buff', 'niche', '💪', true),
    ('Foodie', 'foodie', 'niche', '🍽️', true),
    ('Pet Parent', 'pet-parent', 'niche', '🐾', true),

    -- Occasion tags
    ('Birthday', 'birthday', 'occasion', '🎂', true),
    ('Christmas', 'christmas', 'occasion', '🎄', true),
    ('Valentine''s Day', 'valentines-day', 'occasion', '💝', true),
    ('Mother''s Day', 'mothers-day', 'occasion', '💐', true),
    ('Father''s Day', 'fathers-day', 'occasion', '👔', true),
    ('Anniversary', 'anniversary', 'occasion', '💍', true),
    ('Graduation', 'graduation', 'occasion', '🎓', false),
    ('Wedding', 'wedding', 'occasion', '💒', false),
    ('Housewarming', 'housewarming', 'occasion', '🏡', false),

    -- Trait tags
    ('Minimalist', 'minimalist', 'trait', '⬜', false),
    ('Maximalist', 'maximalist', 'trait', '🎨', false),
    ('Eco-Conscious', 'eco-conscious', 'trait', '🌍', true),
    ('Luxury Lover', 'luxury-lover', 'trait', '💎', false),
    ('Budget-Friendly', 'budget-friendly', 'trait', '💰', true),
    ('Tech Savvy', 'tech-savvy', 'trait', '🤖', true),
    ('Creative', 'creative', 'trait', '🎨', true),
    ('Practical', 'practical', 'trait', '🔨', false),

    -- Demographic tags
    ('For Her', 'tag-for-her', 'demographic', '👩', true),
    ('For Him', 'tag-for-him', 'demographic', '👨', true),
    ('For Teens', 'for-teens', 'demographic', '🧑', false),
    ('For Seniors', 'for-seniors', 'demographic', '👴', false),
    ('Couples', 'couples', 'demographic', '💑', true),

    -- Style tags
    ('Cozy', 'cozy', 'style', '🧸', true),
    ('Modern', 'modern', 'style', '🔲', true),
    ('Vintage', 'vintage', 'style', '📻', false),
    ('Boho', 'boho', 'style', '🌻', false),
    ('Kawaii', 'kawaii', 'style', '🌸', false),
    ('Elegant', 'elegant', 'style', '✨', true),
    ('Rustic', 'rustic', 'style', '🪵', false)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 9. COMMENTS
-- ============================================================================
COMMENT ON TABLE categories IS 'Product category hierarchy (max 3 levels)';
COMMENT ON TABLE tags IS 'Flexible tags for niches, occasions, traits, demographics, and styles';
COMMENT ON TABLE products IS 'Product catalog with affiliate links';
COMMENT ON TABLE product_tags IS 'Many-to-many relationship between products and tags';
COMMENT ON TABLE product_psychology IS 'OCEAN/MBTI mapping for psychology-based recommendations';

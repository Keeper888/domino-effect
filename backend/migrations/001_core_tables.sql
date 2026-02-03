-- ============================================================================
-- GIFT GIVER - CORE TABLES
-- Migration: 001_core_tables.sql
-- Purpose: User profiles, personas, and psychology profiles
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. PROFILES TABLE (extends auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    display_name TEXT,
    avatar_url TEXT,
    detected_region TEXT DEFAULT 'UK',
    preferred_region TEXT,
    preferred_currency TEXT,
    onboarding_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. PERSONAS TABLE (gift recipients)
-- ============================================================================
CREATE TABLE IF NOT EXISTS personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Basic info
    name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    avatar_emoji TEXT,

    -- Birthday (stored as month/day for annual events)
    birthday_month INT CHECK (birthday_month BETWEEN 1 AND 12),
    birthday_day INT CHECK (birthday_day BETWEEN 1 AND 31),

    -- Preferences
    style TEXT,
    budget_range TEXT,

    -- Training level (increases as user provides more feedback)
    training_level INT DEFAULT 0 CHECK (training_level BETWEEN 0 AND 100),

    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_personas_user_id ON personas(user_id);
CREATE INDEX idx_personas_relationship ON personas(relationship);

CREATE TRIGGER update_personas_updated_at
    BEFORE UPDATE ON personas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. PERSONA INTERESTS (many-to-many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS persona_interests (
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    interest TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (persona_id, interest)
);

CREATE INDEX idx_persona_interests_persona ON persona_interests(persona_id);
CREATE INDEX idx_persona_interests_interest ON persona_interests(interest);

-- ============================================================================
-- 4. PERSONA PSYCHOLOGY PROFILES (OCEAN/Big Five + MBTI)
-- ============================================================================
CREATE TABLE IF NOT EXISTS persona_psychology (
    persona_id UUID PRIMARY KEY REFERENCES personas(id) ON DELETE CASCADE,

    -- OCEAN/Big Five traits (0-100 scale)
    openness INT DEFAULT 50 CHECK (openness BETWEEN 0 AND 100),
    conscientiousness INT DEFAULT 50 CHECK (conscientiousness BETWEEN 0 AND 100),
    extraversion INT DEFAULT 50 CHECK (extraversion BETWEEN 0 AND 100),
    agreeableness INT DEFAULT 50 CHECK (agreeableness BETWEEN 0 AND 100),
    neuroticism INT DEFAULT 50 CHECK (neuroticism BETWEEN 0 AND 100),

    -- MBTI type (inferred from OCEAN scores)
    mbti_type CHAR(4) CHECK (mbti_type IN (
        'INTJ', 'INTP', 'ENTJ', 'ENTP',
        'INFJ', 'INFP', 'ENFJ', 'ENFP',
        'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
        'ISTP', 'ISFP', 'ESTP', 'ESFP'
    )),

    -- Confidence in the assessment (0-100)
    confidence_score INT DEFAULT 50,

    -- Raw quiz answers (for recalculation)
    quiz_answers JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_persona_psychology_updated_at
    BEFORE UPDATE ON persona_psychology
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. DISCOVERY SESSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS discovery_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,

    -- Session context
    occasion TEXT,
    budget_range TEXT,

    -- Session state
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    -- Results
    total_viewed INT DEFAULT 0,
    total_liked INT DEFAULT 0,
    total_passed INT DEFAULT 0
);

CREATE INDEX idx_discovery_sessions_user ON discovery_sessions(user_id);
CREATE INDEX idx_discovery_sessions_persona ON discovery_sessions(persona_id);
CREATE INDEX idx_discovery_sessions_started ON discovery_sessions(started_at DESC);

-- ============================================================================
-- 6. SESSION INTERACTIONS (likes/passes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS session_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES discovery_sessions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,

    -- Action type
    action TEXT NOT NULL CHECK (action IN ('like', 'pass', 'save', 'click')),

    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_session_interactions_session ON session_interactions(session_id);
CREATE INDEX idx_session_interactions_product ON session_interactions(product_id);
CREATE INDEX idx_session_interactions_action ON session_interactions(action);

-- ============================================================================
-- 7. CALENDAR EVENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,

    -- Event details
    title TEXT NOT NULL,
    event_date DATE NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'birthday', 'anniversary', 'holiday', 'custom'
    )),

    -- Optional settings
    reminder_days INT DEFAULT 7,
    is_recurring BOOLEAN DEFAULT true,
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_events_user ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX idx_calendar_events_persona ON calendar_events(persona_id);

-- ============================================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================================

-- Profiles: users can only access their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Personas: users can only access their own personas
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own personas"
    ON personas FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own personas"
    ON personas FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own personas"
    ON personas FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own personas"
    ON personas FOR DELETE
    USING (auth.uid() = user_id);

-- Persona interests: follows persona access
ALTER TABLE persona_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage persona interests"
    ON persona_interests FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM personas
            WHERE personas.id = persona_interests.persona_id
            AND personas.user_id = auth.uid()
        )
    );

-- Persona psychology: follows persona access
ALTER TABLE persona_psychology ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage persona psychology"
    ON persona_psychology FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM personas
            WHERE personas.id = persona_psychology.persona_id
            AND personas.user_id = auth.uid()
        )
    );

-- Discovery sessions: users can only access their own
ALTER TABLE discovery_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sessions"
    ON discovery_sessions FOR ALL
    USING (auth.uid() = user_id);

-- Session interactions: follows session access
ALTER TABLE session_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage session interactions"
    ON session_interactions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM discovery_sessions
            WHERE discovery_sessions.id = session_interactions.session_id
            AND discovery_sessions.user_id = auth.uid()
        )
    );

-- Calendar events: users can only access their own
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own events"
    ON calendar_events FOR ALL
    USING (auth.uid() = user_id);

-- ============================================================================
-- 9. FUNCTIONS
-- ============================================================================

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- 10. COMMENTS
-- ============================================================================
COMMENT ON TABLE profiles IS 'Extended user profiles with preferences';
COMMENT ON TABLE personas IS 'Gift recipients created by users';
COMMENT ON TABLE persona_interests IS 'Interests/hobbies associated with personas';
COMMENT ON TABLE persona_psychology IS 'OCEAN/Big Five psychology profiles for personas';
COMMENT ON TABLE discovery_sessions IS 'Gift discovery browsing sessions';
COMMENT ON TABLE session_interactions IS 'User interactions (likes/passes) during discovery';
COMMENT ON TABLE calendar_events IS 'Important dates and reminders';

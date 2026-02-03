/**
 * Gift Giver - Configuration
 * Environment settings and Supabase configuration
 */

const GiftConfig = {
    // Supabase Configuration (Self-hosted on Hetzner via Coolify)
    SUPABASE_URL: 'https://api.giftgiver.space',
    SUPABASE_ANON_KEY: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3MDEyMjI4MCwiZXhwIjo0OTI1Nzk1ODgwLCJyb2xlIjoiYW5vbiJ9.rjTej2Kd_-aYC5sENSJnMnib3Fgc4NmZwCyy13fQgs8',

    // Regions with currency settings
    REGIONS: {
        UK: { code: 'UK', name: 'United Kingdom', currency: 'GBP', symbol: '£', locale: 'en-GB' },
        US: { code: 'US', name: 'United States', currency: 'USD', symbol: '$', locale: 'en-US' },
        IT: { code: 'IT', name: 'Italy', currency: 'EUR', symbol: '€', locale: 'it-IT' }
    },

    // Default region
    DEFAULT_REGION: 'UK',

    // Psychology framework settings
    PSYCHOLOGY: {
        OCEAN_MIN: 0,
        OCEAN_MAX: 100,
        OCEAN_DEFAULT: 50,
        MBTI_TYPES: [
            'INTJ', 'INTP', 'ENTJ', 'ENTP',
            'INFJ', 'INFP', 'ENFJ', 'ENFP',
            'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
            'ISTP', 'ISFP', 'ESTP', 'ESFP'
        ]
    },

    // Budget ranges with price bounds
    BUDGETS: {
        'under25': { min: 0, max: 25, label: 'Under $25' },
        '25-50': { min: 25, max: 50, label: '$25 - $50' },
        '50-100': { min: 50, max: 100, label: '$50 - $100' },
        '100-200': { min: 100, max: 200, label: '$100 - $200' },
        '200plus': { min: 200, max: 9999, label: '$200+' }
    },

    // API endpoints (Edge Functions)
    API: {
        TRACK_CLICK: '/functions/v1/track-click',
        DETECT_REGION: '/functions/v1/detect-region',
        RECOMMEND_GIFTS: '/functions/v1/recommend-gifts',
        CHECK_LINKS: '/functions/v1/check-links'
    },

    // Feature flags
    FEATURES: {
        PSYCHOLOGY_SCORING: true,
        MULTI_REGION: true,
        AFFILIATE_TRACKING: true,
        OFFLINE_MODE: true
    },

    // Initialize configuration (call this after setting Supabase credentials)
    init(supabaseUrl, supabaseKey) {
        this.SUPABASE_URL = supabaseUrl;
        this.SUPABASE_ANON_KEY = supabaseKey;
        console.log('[GiftConfig] Initialized with Supabase URL:', supabaseUrl);
    },

    // Get region by code
    getRegion(code) {
        return this.REGIONS[code] || this.REGIONS[this.DEFAULT_REGION];
    },

    // Format price for a region
    formatPrice(price, regionCode) {
        const region = this.getRegion(regionCode);
        return new Intl.NumberFormat(region.locale, {
            style: 'currency',
            currency: region.currency
        }).format(price);
    },

    // Get budget range
    getBudgetRange(budgetKey) {
        return this.BUDGETS[budgetKey] || this.BUDGETS['50-100'];
    },

    // Check if Supabase is configured
    isConfigured() {
        return this.SUPABASE_URL && this.SUPABASE_ANON_KEY;
    }
};

// Make available globally
window.GiftConfig = GiftConfig;

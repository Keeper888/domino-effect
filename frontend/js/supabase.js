/**
 * Gift Giver - Supabase Client Wrapper
 * Handles all Supabase interactions
 */

const GiftSupabase = {
    client: null,
    user: null,
    region: null,

    // Initialize Supabase client
    init() {
        if (!GiftConfig.isConfigured()) {
            console.warn('[GiftSupabase] Not configured - running in offline mode');
            return false;
        }

        // Initialize Supabase client
        this.client = supabase.createClient(
            GiftConfig.SUPABASE_URL,
            GiftConfig.SUPABASE_ANON_KEY
        );

        // Set up auth state listener
        this.client.auth.onAuthStateChange((event, session) => {
            this.user = session?.user || null;
            console.log('[GiftSupabase] Auth state changed:', event, this.user?.email);

            // Dispatch custom event for UI updates
            window.dispatchEvent(new CustomEvent('authStateChange', {
                detail: { event, user: this.user }
            }));

            // Sync localStorage data on login
            if (event === 'SIGNED_IN' && this.user) {
                this.syncLocalData();
            }
        });

        // Detect region
        this.detectRegion();

        console.log('[GiftSupabase] Initialized');
        return true;
    },

    // ==================== AUTH ====================
    async signUp(email, password, name) {
        if (!this.client) return { error: { message: 'Not connected' } };

        const { data, error } = await this.client.auth.signUp({
            email,
            password,
            options: {
                data: { display_name: name }
            }
        });

        if (!error && data.user) {
            // Create profile
            await this.client.from('profiles').insert({
                id: data.user.id,
                display_name: name,
                detected_region: this.region || GiftConfig.DEFAULT_REGION
            });
        }

        return { data, error };
    },

    async signIn(email, password) {
        if (!this.client) return { error: { message: 'Not connected' } };

        const { data, error } = await this.client.auth.signInWithPassword({
            email,
            password
        });

        return { data, error };
    },

    async signOut() {
        if (!this.client) return { error: { message: 'Not connected' } };

        const { error } = await this.client.auth.signOut();
        this.user = null;
        return { error };
    },

    async getSession() {
        if (!this.client) return null;
        const { data } = await this.client.auth.getSession();
        return data.session;
    },

    isAuthenticated() {
        return !!this.user;
    },

    // ==================== PROFILES ====================
    async getProfile() {
        if (!this.client || !this.user) return null;

        const { data, error } = await this.client
            .from('profiles')
            .select('*')
            .eq('id', this.user.id)
            .single();

        return error ? null : data;
    },

    async updateProfile(updates) {
        if (!this.client || !this.user) return { error: { message: 'Not authenticated' } };

        const { data, error } = await this.client
            .from('profiles')
            .update(updates)
            .eq('id', this.user.id)
            .select()
            .single();

        return { data, error };
    },

    // ==================== PERSONAS ====================
    async getPersonas() {
        if (!this.client || !this.user) return [];

        const { data, error } = await this.client
            .from('personas')
            .select(`
                *,
                persona_interests(interest),
                persona_psychology(*)
            `)
            .eq('user_id', this.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[GiftSupabase] Error fetching personas:', error);
            return [];
        }

        // Transform interests from array of objects to array of strings
        return data.map(p => ({
            ...p,
            interests: p.persona_interests?.map(i => i.interest) || [],
            psychology: p.persona_psychology || null
        }));
    },

    async getPersonaById(id) {
        if (!this.client || !this.user) return null;

        const { data, error } = await this.client
            .from('personas')
            .select(`
                *,
                persona_interests(interest),
                persona_psychology(*)
            `)
            .eq('id', id)
            .eq('user_id', this.user.id)
            .single();

        if (error) return null;

        return {
            ...data,
            interests: data.persona_interests?.map(i => i.interest) || [],
            psychology: data.persona_psychology || null
        };
    },

    async createPersona(persona) {
        if (!this.client || !this.user) return { error: { message: 'Not authenticated' } };

        // Extract interests and psychology from persona
        const { interests, psychology, ...personaData } = persona;

        // Insert persona
        const { data: newPersona, error: personaError } = await this.client
            .from('personas')
            .insert({
                ...personaData,
                user_id: this.user.id,
                birthday_month: persona.birthday ? parseInt(persona.birthday.split('-')[1]) : null,
                birthday_day: persona.birthday ? parseInt(persona.birthday.split('-')[2]) : null
            })
            .select()
            .single();

        if (personaError) return { error: personaError };

        // Insert interests
        if (interests && interests.length > 0) {
            const interestRows = interests.map(interest => ({
                persona_id: newPersona.id,
                interest
            }));
            await this.client.from('persona_interests').insert(interestRows);
        }

        // Insert psychology profile if provided
        if (psychology) {
            await this.client.from('persona_psychology').insert({
                persona_id: newPersona.id,
                ...psychology
            });
        }

        return { data: newPersona, error: null };
    },

    async updatePersona(id, updates) {
        if (!this.client || !this.user) return { error: { message: 'Not authenticated' } };

        const { interests, psychology, ...personaUpdates } = updates;

        const { data, error } = await this.client
            .from('personas')
            .update(personaUpdates)
            .eq('id', id)
            .eq('user_id', this.user.id)
            .select()
            .single();

        // Update interests if provided
        if (interests) {
            await this.client.from('persona_interests').delete().eq('persona_id', id);
            const interestRows = interests.map(interest => ({
                persona_id: id,
                interest
            }));
            await this.client.from('persona_interests').insert(interestRows);
        }

        // Update psychology if provided
        if (psychology) {
            await this.client
                .from('persona_psychology')
                .upsert({ persona_id: id, ...psychology });
        }

        return { data, error };
    },

    async deletePersona(id) {
        if (!this.client || !this.user) return { error: { message: 'Not authenticated' } };

        const { error } = await this.client
            .from('personas')
            .delete()
            .eq('id', id)
            .eq('user_id', this.user.id);

        return { error };
    },

    // ==================== PRODUCTS ====================
    async getProducts(options = {}) {
        if (!this.client) return [];

        const { category, tags, budget, region, limit = 50, offset = 0 } = options;

        let query = this.client
            .from('products')
            .select(`
                *,
                category:categories(name, slug),
                product_tags(tag:tags(name, slug, tag_type)),
                product_regions!inner(local_price, affiliate_link, in_stock),
                product_psychology(*)
            `)
            .eq('status', 'active')
            .eq('product_regions.region_code', region || this.region || GiftConfig.DEFAULT_REGION)
            .eq('product_regions.in_stock', true);

        if (category) {
            query = query.eq('category.slug', category);
        }

        if (budget) {
            const range = GiftConfig.getBudgetRange(budget);
            query = query.gte('product_regions.local_price', range.min)
                         .lte('product_regions.local_price', range.max);
        }

        query = query.range(offset, offset + limit - 1);

        const { data, error } = await query;

        if (error) {
            console.error('[GiftSupabase] Error fetching products:', error);
            return [];
        }

        return data;
    },

    async getProductById(id) {
        if (!this.client) return null;

        const { data, error } = await this.client
            .from('products')
            .select(`
                *,
                category:categories(name, slug),
                product_tags(tag:tags(name, slug, tag_type)),
                product_regions(region_code, local_price, affiliate_link, in_stock),
                product_psychology(*)
            `)
            .eq('id', id)
            .single();

        return error ? null : data;
    },

    // ==================== DISCOVERY SESSIONS ====================
    async createSession(sessionData) {
        if (!this.client || !this.user) return { error: { message: 'Not authenticated' } };

        const { data, error } = await this.client
            .from('discovery_sessions')
            .insert({
                user_id: this.user.id,
                ...sessionData
            })
            .select()
            .single();

        return { data, error };
    },

    async updateSession(id, updates) {
        if (!this.client || !this.user) return { error: { message: 'Not authenticated' } };

        const { data, error } = await this.client
            .from('discovery_sessions')
            .update(updates)
            .eq('id', id)
            .eq('user_id', this.user.id)
            .select()
            .single();

        return { data, error };
    },

    async addSessionInteraction(sessionId, productId, action) {
        if (!this.client) return { error: { message: 'Not connected' } };

        const { data, error } = await this.client
            .from('session_interactions')
            .insert({
                session_id: sessionId,
                product_id: productId,
                action
            })
            .select()
            .single();

        return { data, error };
    },

    async getSessions() {
        if (!this.client || !this.user) return [];

        const { data, error } = await this.client
            .from('discovery_sessions')
            .select(`
                *,
                persona:personas(name, relationship),
                interactions:session_interactions(product_id, action)
            `)
            .eq('user_id', this.user.id)
            .order('started_at', { ascending: false });

        return error ? [] : data;
    },

    // ==================== CALENDAR ====================
    async getCalendarEvents() {
        if (!this.client || !this.user) return [];

        const { data, error } = await this.client
            .from('calendar_events')
            .select(`
                *,
                persona:personas(name)
            `)
            .eq('user_id', this.user.id)
            .order('event_date', { ascending: true });

        return error ? [] : data;
    },

    async createCalendarEvent(event) {
        if (!this.client || !this.user) return { error: { message: 'Not authenticated' } };

        const { data, error } = await this.client
            .from('calendar_events')
            .insert({
                user_id: this.user.id,
                ...event
            })
            .select()
            .single();

        return { data, error };
    },

    async deleteCalendarEvent(id) {
        if (!this.client || !this.user) return { error: { message: 'Not authenticated' } };

        const { error } = await this.client
            .from('calendar_events')
            .delete()
            .eq('id', id)
            .eq('user_id', this.user.id);

        return { error };
    },

    // ==================== AFFILIATE TRACKING ====================
    async trackClick(productId, affiliateUrl) {
        if (!this.client) return;

        try {
            const response = await fetch(
                `${GiftConfig.SUPABASE_URL}${GiftConfig.API.TRACK_CLICK}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${GiftConfig.SUPABASE_ANON_KEY}`
                    },
                    body: JSON.stringify({
                        product_id: productId,
                        affiliate_url: affiliateUrl,
                        region_code: this.region,
                        user_id: this.user?.id
                    })
                }
            );

            const data = await response.json();
            return data.redirect_url || affiliateUrl;
        } catch (error) {
            console.error('[GiftSupabase] Track click error:', error);
            return affiliateUrl;
        }
    },

    // ==================== REGION DETECTION ====================
    async detectRegion() {
        // Check localStorage first
        const savedRegion = localStorage.getItem('giftgiver_region');
        if (savedRegion) {
            this.region = savedRegion;
            return savedRegion;
        }

        // Try Edge Function
        if (this.client) {
            try {
                const response = await fetch(
                    `${GiftConfig.SUPABASE_URL}${GiftConfig.API.DETECT_REGION}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${GiftConfig.SUPABASE_ANON_KEY}`
                        }
                    }
                );
                const data = await response.json();
                if (data.region) {
                    this.region = data.region;
                    localStorage.setItem('giftgiver_region', data.region);
                    return data.region;
                }
            } catch (error) {
                console.warn('[GiftSupabase] Region detection failed:', error);
            }
        }

        // Default
        this.region = GiftConfig.DEFAULT_REGION;
        return this.region;
    },

    setRegion(regionCode) {
        if (GiftConfig.REGIONS[regionCode]) {
            this.region = regionCode;
            localStorage.setItem('giftgiver_region', regionCode);
            window.dispatchEvent(new CustomEvent('regionChange', {
                detail: { region: regionCode }
            }));
        }
    },

    // ==================== DATA SYNC ====================
    async syncLocalData() {
        console.log('[GiftSupabase] Syncing local data...');

        // Sync personas from localStorage
        const localPersonas = JSON.parse(localStorage.getItem('giftgiver_personas') || '[]');
        if (localPersonas.length > 0) {
            for (const persona of localPersonas) {
                // Check if already exists
                const existing = await this.getPersonaById(persona.id);
                if (!existing) {
                    await this.createPersona(persona);
                }
            }
            // Clear local after sync
            localStorage.removeItem('giftgiver_personas');
            console.log('[GiftSupabase] Synced', localPersonas.length, 'personas');
        }

        // Sync sessions
        const localSessions = JSON.parse(localStorage.getItem('giftgiver_sessions') || '[]');
        if (localSessions.length > 0) {
            for (const session of localSessions) {
                await this.createSession(session);
            }
            localStorage.removeItem('giftgiver_sessions');
            console.log('[GiftSupabase] Synced', localSessions.length, 'sessions');
        }

        // Sync calendar events
        const localEvents = JSON.parse(localStorage.getItem('giftgiver_calendar') || '[]');
        if (localEvents.length > 0) {
            for (const event of localEvents) {
                if (!event.id.startsWith('h')) { // Skip default holidays
                    await this.createCalendarEvent(event);
                }
            }
            localStorage.removeItem('giftgiver_calendar');
            console.log('[GiftSupabase] Synced calendar events');
        }
    },

    // ==================== GIFT RECOMMENDATIONS ====================
    async getRecommendations(personaId, options = {}) {
        if (!this.client) return [];

        const persona = await this.getPersonaById(personaId);
        if (!persona) return [];

        try {
            const response = await fetch(
                `${GiftConfig.SUPABASE_URL}${GiftConfig.API.RECOMMEND_GIFTS}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${GiftConfig.SUPABASE_ANON_KEY}`
                    },
                    body: JSON.stringify({
                        persona_id: personaId,
                        psychology: persona.psychology,
                        interests: persona.interests,
                        budget: options.budget,
                        region: this.region,
                        limit: options.limit || 20
                    })
                }
            );

            const data = await response.json();
            return data.products || [];
        } catch (error) {
            console.error('[GiftSupabase] Recommendations error:', error);
            // Fallback to basic query
            return this.getProducts(options);
        }
    }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only init if config is set
    if (GiftConfig.isConfigured()) {
        GiftSupabase.init();
    }
});

// Make available globally
window.GiftSupabase = GiftSupabase;

/**
 * Gift Giver - Storage Abstraction Layer
 * Hybrid storage: Supabase (online) + localStorage (offline/fallback)
 */

const GiftStorage = {
    KEYS: {
        USER: 'giftgiver_user',
        PERSONAS: 'giftgiver_personas',
        SESSIONS: 'giftgiver_sessions',
        CALENDAR: 'giftgiver_calendar',
        CURRENT_QUIZ: 'giftgiver_current_quiz',
        CURRENT_DISCOVERY: 'giftgiver_current_discovery',
        REGION: 'giftgiver_region'
    },

    // Check if Supabase is available and user is authenticated
    _useSupabase() {
        return GiftConfig?.isConfigured() &&
               GiftSupabase?.client &&
               GiftSupabase?.isAuthenticated();
    },

    // ==================== USER ====================
    getUser() {
        // Check Supabase user first
        if (GiftSupabase?.user) {
            return {
                id: GiftSupabase.user.id,
                email: GiftSupabase.user.email,
                name: GiftSupabase.user.user_metadata?.display_name ||
                      GiftSupabase.user.email?.split('@')[0],
                createdAt: GiftSupabase.user.created_at
            };
        }

        // Fallback to localStorage
        const data = localStorage.getItem(this.KEYS.USER);
        return data ? JSON.parse(data) : null;
    },

    setUser(user) {
        localStorage.setItem(this.KEYS.USER, JSON.stringify(user));
    },

    clearUser() {
        localStorage.removeItem(this.KEYS.USER);
    },

    isLoggedIn() {
        return this.getUser() !== null;
    },

    // ==================== PERSONAS ====================
    async getPersonas() {
        // Try Supabase first
        if (this._useSupabase()) {
            const personas = await GiftSupabase.getPersonas();
            // Transform to match local format
            return personas.map(p => ({
                id: p.id,
                name: p.name,
                relationship: p.relationship,
                birthday: p.birthday_month && p.birthday_day ?
                    `${new Date().getFullYear()}-${String(p.birthday_month).padStart(2, '0')}-${String(p.birthday_day).padStart(2, '0')}` :
                    null,
                interests: p.interests || [],
                style: p.style,
                budget: p.budget_range,
                trainingLevel: p.training_level || 0,
                createdAt: p.created_at,
                psychology: p.psychology
            }));
        }

        // Fallback to localStorage
        const data = localStorage.getItem(this.KEYS.PERSONAS);
        return data ? JSON.parse(data) : [];
    },

    // Sync version for backward compatibility
    getPersonasSync() {
        const data = localStorage.getItem(this.KEYS.PERSONAS);
        return data ? JSON.parse(data) : [];
    },

    setPersonas(personas) {
        localStorage.setItem(this.KEYS.PERSONAS, JSON.stringify(personas));
    },

    async addPersona(persona) {
        // Try Supabase first
        if (this._useSupabase()) {
            const { data, error } = await GiftSupabase.createPersona({
                name: persona.name,
                relationship: persona.relationship,
                birthday: persona.birthday,
                style: persona.style,
                budget_range: persona.budget,
                interests: persona.interests,
                psychology: persona.psychology
            });

            if (!error && data) {
                return {
                    ...persona,
                    id: data.id,
                    createdAt: data.created_at,
                    trainingLevel: 0
                };
            }
        }

        // Fallback to localStorage
        const personas = this.getPersonasSync();
        persona.id = this.generateId();
        persona.createdAt = new Date().toISOString();
        persona.trainingLevel = 0;
        personas.push(persona);
        this.setPersonas(personas);
        return persona;
    },

    async updatePersona(id, updates) {
        // Try Supabase first
        if (this._useSupabase()) {
            const { data, error } = await GiftSupabase.updatePersona(id, {
                ...updates,
                budget_range: updates.budget,
                training_level: updates.trainingLevel
            });

            if (!error) {
                return data;
            }
        }

        // Fallback to localStorage
        const personas = this.getPersonasSync();
        const index = personas.findIndex(p => p.id === id);
        if (index !== -1) {
            personas[index] = { ...personas[index], ...updates };
            this.setPersonas(personas);
            return personas[index];
        }
        return null;
    },

    async deletePersona(id) {
        // Try Supabase first
        if (this._useSupabase()) {
            await GiftSupabase.deletePersona(id);
        }

        // Also remove from localStorage
        const personas = this.getPersonasSync();
        const filtered = personas.filter(p => p.id !== id);
        this.setPersonas(filtered);
    },

    async getPersonaById(id) {
        // Try Supabase first
        if (this._useSupabase()) {
            const persona = await GiftSupabase.getPersonaById(id);
            if (persona) {
                return {
                    id: persona.id,
                    name: persona.name,
                    relationship: persona.relationship,
                    birthday: persona.birthday_month && persona.birthday_day ?
                        `${new Date().getFullYear()}-${String(persona.birthday_month).padStart(2, '0')}-${String(persona.birthday_day).padStart(2, '0')}` :
                        null,
                    interests: persona.interests || [],
                    style: persona.style,
                    budget: persona.budget_range,
                    trainingLevel: persona.training_level || 0,
                    createdAt: persona.created_at,
                    psychology: persona.psychology
                };
            }
        }

        // Fallback to localStorage
        const personas = this.getPersonasSync();
        return personas.find(p => p.id === id) || null;
    },

    // Sync version for backward compatibility
    getPersonaByIdSync(id) {
        const personas = this.getPersonasSync();
        return personas.find(p => p.id === id) || null;
    },

    // ==================== SESSIONS ====================
    async getSessions() {
        // Try Supabase first
        if (this._useSupabase()) {
            return await GiftSupabase.getSessions();
        }

        // Fallback to localStorage
        const data = localStorage.getItem(this.KEYS.SESSIONS);
        return data ? JSON.parse(data) : [];
    },

    getSessionsSync() {
        const data = localStorage.getItem(this.KEYS.SESSIONS);
        return data ? JSON.parse(data) : [];
    },

    setSessions(sessions) {
        localStorage.setItem(this.KEYS.SESSIONS, JSON.stringify(sessions));
    },

    async addSession(session) {
        // Try Supabase first
        if (this._useSupabase()) {
            const { data, error } = await GiftSupabase.createSession(session);
            if (!error && data) {
                return data;
            }
        }

        // Fallback to localStorage
        const sessions = this.getSessionsSync();
        session.id = this.generateId();
        session.createdAt = new Date().toISOString();
        sessions.unshift(session);
        this.setSessions(sessions);
        return session;
    },

    deleteSession(id) {
        const sessions = this.getSessionsSync();
        const filtered = sessions.filter(s => s.id !== id);
        this.setSessions(filtered);
    },

    getSessionById(id) {
        const sessions = this.getSessionsSync();
        return sessions.find(s => s.id === id) || null;
    },

    getSessionsByPersona(personaId) {
        const sessions = this.getSessionsSync();
        return sessions.filter(s => s.personaId === personaId);
    },

    // ==================== CALENDAR ====================
    async getCalendarEvents() {
        // Try Supabase first
        if (this._useSupabase()) {
            const events = await GiftSupabase.getCalendarEvents();
            if (events.length > 0) {
                return events.map(e => ({
                    id: e.id,
                    title: e.title,
                    date: e.event_date,
                    type: e.event_type,
                    personaId: e.persona_id,
                    icon: this._getEventIcon(e.event_type, e.title)
                }));
            }
        }

        // Fallback to localStorage or default holidays
        const data = localStorage.getItem(this.KEYS.CALENDAR);
        if (data) {
            return JSON.parse(data);
        }
        return this.getDefaultHolidays();
    },

    _getEventIcon(type, title) {
        if (type === 'birthday') return '🎂';
        if (type === 'anniversary') return '💍';

        // Holiday icons
        const holidayIcons = {
            "Valentine's Day": '❤️',
            "Mother's Day": '💐',
            "Father's Day": '👔',
            "Halloween": '🎃',
            "Thanksgiving": '🦃',
            "Christmas": '🎄',
            "New Year's Eve": '🎉'
        };
        return holidayIcons[title] || '📅';
    },

    setCalendarEvents(events) {
        localStorage.setItem(this.KEYS.CALENDAR, JSON.stringify(events));
    },

    async addCalendarEvent(event) {
        // Try Supabase first
        if (this._useSupabase()) {
            const { data, error } = await GiftSupabase.createCalendarEvent({
                title: event.title,
                event_date: event.date,
                event_type: event.type || 'custom',
                persona_id: event.personaId
            });

            if (!error && data) {
                return {
                    id: data.id,
                    ...event
                };
            }
        }

        // Fallback to localStorage
        const events = await this.getCalendarEvents();
        event.id = this.generateId();
        events.push(event);
        this.setCalendarEvents(events);
        return event;
    },

    async deleteCalendarEvent(id) {
        // Try Supabase first
        if (this._useSupabase()) {
            await GiftSupabase.deleteCalendarEvent(id);
        }

        // Also remove from localStorage
        const events = JSON.parse(localStorage.getItem(this.KEYS.CALENDAR) || '[]');
        const filtered = events.filter(e => e.id !== id);
        this.setCalendarEvents(filtered);
    },

    getDefaultHolidays() {
        const year = new Date().getFullYear();
        return [
            { id: 'h1', title: "Valentine's Day", date: `${year}-02-14`, type: 'holiday', icon: '❤️' },
            { id: 'h2', title: "Mother's Day", date: `${year}-05-11`, type: 'holiday', icon: '💐' },
            { id: 'h3', title: "Father's Day", date: `${year}-06-15`, type: 'holiday', icon: '👔' },
            { id: 'h4', title: "Halloween", date: `${year}-10-31`, type: 'holiday', icon: '🎃' },
            { id: 'h5', title: "Thanksgiving", date: `${year}-11-27`, type: 'holiday', icon: '🦃' },
            { id: 'h6', title: "Christmas", date: `${year}-12-25`, type: 'holiday', icon: '🎄' },
            { id: 'h7', title: "New Year's Eve", date: `${year}-12-31`, type: 'holiday', icon: '🎉' },
        ];
    },

    // ==================== CURRENT QUIZ STATE ====================
    getCurrentQuiz() {
        const data = localStorage.getItem(this.KEYS.CURRENT_QUIZ);
        return data ? JSON.parse(data) : null;
    },

    setCurrentQuiz(quizState) {
        localStorage.setItem(this.KEYS.CURRENT_QUIZ, JSON.stringify(quizState));
    },

    clearCurrentQuiz() {
        localStorage.removeItem(this.KEYS.CURRENT_QUIZ);
    },

    // ==================== CURRENT DISCOVERY STATE ====================
    getCurrentDiscovery() {
        const data = localStorage.getItem(this.KEYS.CURRENT_DISCOVERY);
        return data ? JSON.parse(data) : null;
    },

    setCurrentDiscovery(discoveryState) {
        localStorage.setItem(this.KEYS.CURRENT_DISCOVERY, JSON.stringify(discoveryState));
    },

    clearCurrentDiscovery() {
        localStorage.removeItem(this.KEYS.CURRENT_DISCOVERY);
    },

    // ==================== REGION ====================
    getRegion() {
        return GiftSupabase?.region ||
               localStorage.getItem(this.KEYS.REGION) ||
               GiftConfig?.DEFAULT_REGION ||
               'UK';
    },

    setRegion(regionCode) {
        localStorage.setItem(this.KEYS.REGION, regionCode);
        if (GiftSupabase) {
            GiftSupabase.setRegion(regionCode);
        }
    },

    // ==================== UTILITY ====================
    generateId() {
        return 'id_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    clearAll() {
        Object.values(this.KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    },

    // Export all data (for backup)
    async exportData() {
        return {
            user: this.getUser(),
            personas: await this.getPersonas(),
            sessions: await this.getSessions(),
            calendar: await this.getCalendarEvents(),
            region: this.getRegion(),
            exportedAt: new Date().toISOString()
        };
    },

    // Import data (from backup)
    importData(data) {
        if (data.user) this.setUser(data.user);
        if (data.personas) this.setPersonas(data.personas);
        if (data.sessions) this.setSessions(data.sessions);
        if (data.calendar) this.setCalendarEvents(data.calendar);
        if (data.region) this.setRegion(data.region);
    }
};

// Make available globally
window.GiftStorage = GiftStorage;

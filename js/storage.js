/**
 * Gift Giver - LocalStorage Abstraction Layer
 * Handles all data persistence for the MVP
 */

const GiftStorage = {
    KEYS: {
        USER: 'giftgiver_user',
        PERSONAS: 'giftgiver_personas',
        SESSIONS: 'giftgiver_sessions',
        CALENDAR: 'giftgiver_calendar',
        CURRENT_QUIZ: 'giftgiver_current_quiz',
        CURRENT_DISCOVERY: 'giftgiver_current_discovery'
    },

    // ==================== USER ====================
    getUser() {
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
    getPersonas() {
        const data = localStorage.getItem(this.KEYS.PERSONAS);
        return data ? JSON.parse(data) : [];
    },

    setPersonas(personas) {
        localStorage.setItem(this.KEYS.PERSONAS, JSON.stringify(personas));
    },

    addPersona(persona) {
        const personas = this.getPersonas();
        persona.id = this.generateId();
        persona.createdAt = new Date().toISOString();
        persona.trainingLevel = 0;
        personas.push(persona);
        this.setPersonas(personas);
        return persona;
    },

    updatePersona(id, updates) {
        const personas = this.getPersonas();
        const index = personas.findIndex(p => p.id === id);
        if (index !== -1) {
            personas[index] = { ...personas[index], ...updates };
            this.setPersonas(personas);
            return personas[index];
        }
        return null;
    },

    deletePersona(id) {
        const personas = this.getPersonas();
        const filtered = personas.filter(p => p.id !== id);
        this.setPersonas(filtered);
    },

    getPersonaById(id) {
        const personas = this.getPersonas();
        return personas.find(p => p.id === id) || null;
    },

    // ==================== SESSIONS ====================
    getSessions() {
        const data = localStorage.getItem(this.KEYS.SESSIONS);
        return data ? JSON.parse(data) : [];
    },

    setSessions(sessions) {
        localStorage.setItem(this.KEYS.SESSIONS, JSON.stringify(sessions));
    },

    addSession(session) {
        const sessions = this.getSessions();
        session.id = this.generateId();
        session.createdAt = new Date().toISOString();
        sessions.unshift(session); // Add to beginning (newest first)
        this.setSessions(sessions);
        return session;
    },

    deleteSession(id) {
        const sessions = this.getSessions();
        const filtered = sessions.filter(s => s.id !== id);
        this.setSessions(filtered);
    },

    getSessionById(id) {
        const sessions = this.getSessions();
        return sessions.find(s => s.id === id) || null;
    },

    getSessionsByPersona(personaId) {
        const sessions = this.getSessions();
        return sessions.filter(s => s.personaId === personaId);
    },

    // ==================== CALENDAR ====================
    getCalendarEvents() {
        const data = localStorage.getItem(this.KEYS.CALENDAR);
        if (data) {
            return JSON.parse(data);
        }
        // Return default holidays if no custom events
        return this.getDefaultHolidays();
    },

    setCalendarEvents(events) {
        localStorage.setItem(this.KEYS.CALENDAR, JSON.stringify(events));
    },

    addCalendarEvent(event) {
        const events = this.getCalendarEvents();
        event.id = this.generateId();
        events.push(event);
        this.setCalendarEvents(events);
        return event;
    },

    deleteCalendarEvent(id) {
        const events = this.getCalendarEvents();
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
    exportData() {
        return {
            user: this.getUser(),
            personas: this.getPersonas(),
            sessions: this.getSessions(),
            calendar: this.getCalendarEvents(),
            exportedAt: new Date().toISOString()
        };
    },

    // Import data (from backup)
    importData(data) {
        if (data.user) this.setUser(data.user);
        if (data.personas) this.setPersonas(data.personas);
        if (data.sessions) this.setSessions(data.sessions);
        if (data.calendar) this.setCalendarEvents(data.calendar);
    }
};

// Make available globally
window.GiftStorage = GiftStorage;

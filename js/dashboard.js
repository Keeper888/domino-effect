/**
 * Gift Giver - Dashboard Logic
 * Handles dashboard data display and interactions
 */

document.addEventListener('DOMContentLoaded', () => {
    loadDashboardStats();
    loadUpcomingEvents();
    loadRecentActivity();
    loadPersonaTraining();
    loadRecentSessions();
});

function loadDashboardStats() {
    const personas = GiftStorage.getPersonas();
    const sessions = GiftStorage.getSessions();

    // Count total saved gifts
    let totalGifts = 0;
    sessions.forEach(session => {
        if (session.likedGifts) {
            totalGifts += session.likedGifts.length;
        }
    });

    // Update stats
    document.getElementById('personaCount').textContent = personas.length;
    document.getElementById('sessionCount').textContent = sessions.length;
    document.getElementById('savedCount').textContent = totalGifts;
}

function loadUpcomingEvents() {
    const eventList = document.getElementById('eventList');
    if (!eventList) return;

    const events = GiftStorage.getCalendarEvents();
    const personas = GiftStorage.getPersonas();

    // Add persona birthdays
    personas.forEach(persona => {
        if (persona.birthday) {
            events.push({
                id: 'b_' + persona.id,
                title: `${persona.name}'s Birthday`,
                date: persona.birthday,
                type: 'birthday',
                icon: '🎂',
                personaId: persona.id
            });
        }
    });

    // Filter future events and sort by date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = events
        .filter(event => {
            const eventDate = new Date(event.date);
            eventDate.setHours(0, 0, 0, 0);
            return eventDate >= today;
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 4);

    if (upcoming.length === 0) {
        eventList.innerHTML = `
            <div class="widget-empty">
                <div class="widget-empty-icon">📅</div>
                <p class="widget-empty-text">No upcoming occasions</p>
                <a href="calendar.html" class="widget-empty-btn">Add Event</a>
            </div>
        `;
        return;
    }

    eventList.innerHTML = upcoming.map(event => `
        <div class="event-item" data-event-id="${event.id}">
            <span class="event-icon">${event.icon || '🎁'}</span>
            <div class="event-info">
                <div class="event-name">${event.title}</div>
                <div class="event-countdown">${GiftApp.getDaysUntil(event.date)}</div>
            </div>
            <button class="event-action" onclick="startShoppingForEvent('${event.id}')">
                Shop
            </button>
        </div>
    `).join('');
}

function loadRecentActivity() {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;

    const sessions = GiftStorage.getSessions();
    const personas = GiftStorage.getPersonas();

    // Generate activity from sessions and personas
    const activities = [];

    // Recent sessions
    sessions.slice(0, 3).forEach(session => {
        const persona = personas.find(p => p.id === session.personaId);
        activities.push({
            type: 'session',
            icon: '❤️',
            text: `Saved <strong>${session.likedGifts?.length || 0} gifts</strong> for ${persona?.name || 'Unknown'}`,
            time: session.createdAt
        });
    });

    // Recently created personas
    personas
        .filter(p => p.createdAt)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 2)
        .forEach(persona => {
            activities.push({
                type: 'persona',
                icon: '✨',
                text: `Created persona for <strong>${persona.name}</strong>`,
                time: persona.createdAt
            });
        });

    // Sort by time
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));

    if (activities.length === 0) {
        activityList.innerHTML = `
            <div class="widget-empty">
                <div class="widget-empty-icon">🎯</div>
                <p class="widget-empty-text">No recent activity</p>
                <a href="quiz.html" class="widget-empty-btn">Start Discovery</a>
            </div>
        `;
        return;
    }

    activityList.innerHTML = activities.slice(0, 5).map(activity => `
        <div class="activity-item">
            <div class="activity-icon">${activity.icon}</div>
            <div class="activity-text">${activity.text}</div>
            <div class="activity-time">${formatTimeAgo(activity.time)}</div>
        </div>
    `).join('');
}

function loadPersonaTraining() {
    const trainingList = document.getElementById('trainingList');
    if (!trainingList) return;

    const personas = GiftStorage.getPersonas();

    if (personas.length === 0) {
        trainingList.innerHTML = `
            <div class="widget-empty">
                <div class="widget-empty-icon">👤</div>
                <p class="widget-empty-text">No personas yet</p>
                <a href="quiz.html" class="widget-empty-btn">Create Persona</a>
            </div>
        `;
        return;
    }

    trainingList.innerHTML = personas.slice(0, 4).map(persona => {
        const emoji = GiftApp.getRelationshipEmoji(persona.relationship);
        const progress = persona.trainingLevel || calculateTrainingLevel(persona);

        return `
            <div class="training-item">
                <div class="training-avatar">${emoji}</div>
                <div class="training-info">
                    <div class="training-name">${persona.name}</div>
                    <div class="training-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%"></div>
                        </div>
                        <span class="training-percent">${progress}%</span>
                    </div>
                </div>
                <button class="training-action" onclick="trainPersona('${persona.id}')">
                    Train
                </button>
            </div>
        `;
    }).join('');
}

function loadRecentSessions() {
    const sessionsList = document.getElementById('sessionsList');
    if (!sessionsList) return;

    const sessions = GiftStorage.getSessions();
    const personas = GiftStorage.getPersonas();

    if (sessions.length === 0) {
        sessionsList.innerHTML = `
            <div class="widget-empty">
                <div class="widget-empty-icon">💾</div>
                <p class="widget-empty-text">No saved sessions</p>
                <a href="quiz.html" class="widget-empty-btn">Start Discovery</a>
            </div>
        `;
        return;
    }

    sessionsList.innerHTML = sessions.slice(0, 3).map(session => {
        const persona = personas.find(p => p.id === session.personaId);
        const giftCount = session.likedGifts?.length || 0;

        return `
            <div class="session-mini" onclick="viewSession('${session.id}')">
                <div class="session-mini-count">${giftCount}</div>
                <div class="session-mini-info">
                    <div class="session-mini-title">${session.occasion || 'Gift Discovery'} for ${persona?.name || 'Unknown'}</div>
                    <div class="session-mini-date">${GiftApp.formatDate(session.createdAt)}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Helper function to calculate training level based on persona data completeness
function calculateTrainingLevel(persona) {
    let level = 0;
    const fields = ['name', 'relationship', 'interests', 'style', 'budget'];

    fields.forEach(field => {
        if (persona[field]) {
            if (Array.isArray(persona[field]) && persona[field].length > 0) {
                level += 20;
            } else if (!Array.isArray(persona[field])) {
                level += 20;
            }
        }
    });

    // Add bonus for each discovery session
    const sessions = GiftStorage.getSessionsByPersona(persona.id);
    level = Math.min(100, level + (sessions.length * 10));

    return level;
}

function formatTimeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return GiftApp.formatDate(dateStr);
}

// Action handlers
function startShoppingForEvent(eventId) {
    // Navigate to persona selection for discovery
    window.location.href = 'discovery/select-persona.html?event=' + eventId;
}

function trainPersona(personaId) {
    // Navigate directly to occasion selection for this persona
    GiftStorage.setCurrentDiscovery({
        personaId: personaId,
        step: 'occasion'
    });
    window.location.href = 'discovery/occasion.html';
}

function viewSession(sessionId) {
    window.location.href = 'saved/index.html?session=' + sessionId;
}

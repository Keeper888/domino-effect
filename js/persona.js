/**
 * Gift Giver - Persona Management
 * Handles persona list and view pages
 */

let deleteTargetId = null;

document.addEventListener('DOMContentLoaded', () => {
    // Check which page we're on
    if (document.getElementById('personaGrid')) {
        loadPersonaList();
    } else if (document.getElementById('personaProfile')) {
        loadPersonaView();
    }
});

// ==================== LIST PAGE ====================
function loadPersonaList() {
    const grid = document.getElementById('personaGrid');
    const personas = GiftStorage.getPersonas();

    if (personas.length === 0) {
        grid.innerHTML = `
            <a href="../quiz.html" class="add-persona-card">
                <div class="add-persona-icon">+</div>
                <div class="add-persona-text">Create your first persona</div>
            </a>
        `;
        return;
    }

    let html = personas.map(persona => {
        const emoji = GiftApp.getRelationshipEmoji(persona.relationship);
        const sessions = GiftStorage.getSessionsByPersona(persona.id);
        const sessionCount = sessions.length;
        const giftCount = sessions.reduce((sum, s) => sum + (s.likedGifts?.length || 0), 0);

        const interestTags = (persona.interests || []).slice(0, 4).map(i =>
            `<span class="persona-list-tag">${capitalizeFirst(i)}</span>`
        ).join('');

        // Format birthday display
        let birthdayDisplay = '';
        if (persona.birthday) {
            const date = new Date(persona.birthday);
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            birthdayDisplay = `🎂 ${monthNames[date.getMonth()]} ${date.getDate()}`;
        }

        return `
            <div class="persona-list-card" onclick="viewPersona('${persona.id}')">
                <div class="persona-list-avatar">${emoji}</div>
                <div class="persona-list-info">
                    <div class="persona-list-name">${persona.name}</div>
                    <div class="persona-list-relationship">
                        ${capitalizeFirst(persona.relationship || 'Special')}
                        ${birthdayDisplay ? `<span class="persona-list-birthday">${birthdayDisplay}</span>` : ''}
                    </div>
                    <div class="persona-list-tags">${interestTags}</div>
                    <div class="persona-list-meta">
                        <span>📊 ${sessionCount} sessions</span>
                        <span>❤️ ${giftCount} gifts saved</span>
                    </div>
                </div>
                <div class="persona-list-actions" onclick="event.stopPropagation()">
                    <button class="persona-action-btn primary" onclick="startDiscovery('${persona.id}')" title="Start Discovery">
                        🎯
                    </button>
                    <button class="persona-action-btn secondary" onclick="openDeleteModal('${persona.id}', '${persona.name}')" title="Delete">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Add "Create New" card at the end
    html += `
        <a href="../quiz.html" class="add-persona-card">
            <div class="add-persona-icon">+</div>
            <div class="add-persona-text">Add another persona</div>
        </a>
    `;

    grid.innerHTML = html;
}

// ==================== VIEW PAGE ====================
function loadPersonaView() {
    const params = new URLSearchParams(window.location.search);
    const personaId = params.get('id');

    if (!personaId) {
        window.location.href = 'list.html';
        return;
    }

    const persona = GiftStorage.getPersonaById(personaId);
    if (!persona) {
        GiftApp.showToast('Persona not found', 'error');
        window.location.href = 'list.html';
        return;
    }

    renderPersonaProfile(persona);
    renderTrainingSection(persona);
    renderSessionHistory(persona);
}

function renderPersonaProfile(persona) {
    const profile = document.getElementById('personaProfile');
    const emoji = GiftApp.getRelationshipEmoji(persona.relationship);

    const interestTags = (persona.interests || []).map(i =>
        `<span class="persona-interest-tag">${capitalizeFirst(i)}</span>`
    ).join('');

    const budgetLabel = getBudgetLabel(persona.budget);
    const styleLabel = capitalizeFirst(persona.style || 'Modern');

    // Format birthday display
    let birthdayDisplay = '';
    if (persona.birthday) {
        const date = new Date(persona.birthday);
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        birthdayDisplay = `${monthNames[date.getMonth()]} ${date.getDate()}`;
    }

    profile.innerHTML = `
        <div class="persona-profile-header">
            <div class="persona-profile-avatar">${emoji}</div>
            <div>
                <h1 class="persona-profile-name">${persona.name}</h1>
                <div class="persona-profile-relationship">${capitalizeFirst(persona.relationship || 'Someone Special')}</div>
                ${birthdayDisplay ? `<div class="persona-profile-birthday">🎂 ${birthdayDisplay}</div>` : ''}
                <div class="persona-profile-actions">
                    <button class="btn btn-orange btn-sm" onclick="startDiscovery('${persona.id}')">
                        🎯 Start Discovery
                    </button>
                    <button class="btn btn-white btn-sm" onclick="openDeleteModal('${persona.id}', '${persona.name}')">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        </div>
        <div class="persona-profile-body">
            <div class="persona-section">
                <div class="persona-section-title">Interests</div>
                <div class="persona-interests">
                    ${interestTags || '<span class="persona-interest-tag">No interests set</span>'}
                </div>
            </div>
            <div class="persona-section">
                <div class="persona-detail-row">
                    ${birthdayDisplay ? `
                    <div class="persona-detail-item">
                        <div class="persona-detail-label">Birthday</div>
                        <div class="persona-detail-value">${birthdayDisplay}</div>
                    </div>
                    ` : ''}
                    <div class="persona-detail-item">
                        <div class="persona-detail-label">Style</div>
                        <div class="persona-detail-value">${styleLabel}</div>
                    </div>
                    <div class="persona-detail-item">
                        <div class="persona-detail-label">Budget Range</div>
                        <div class="persona-detail-value">${budgetLabel}</div>
                    </div>
                    <div class="persona-detail-item">
                        <div class="persona-detail-label">Created</div>
                        <div class="persona-detail-value">${GiftApp.formatDate(persona.createdAt)}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderTrainingSection(persona) {
    const section = document.getElementById('trainingSection');
    const progress = calculateTrainingLevel(persona);

    section.innerHTML = `
        <div class="persona-training-header">
            <span class="persona-training-level">Training Level</span>
            <span class="persona-training-percent">${progress}%</span>
        </div>
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
        <p class="persona-training-tip">
            ${progress < 50
                ? '💡 Complete more discovery sessions to improve gift recommendations!'
                : progress < 80
                    ? '🌟 Getting better! A few more sessions will perfect the recommendations.'
                    : '🎉 Excellent! Gift recommendations are highly personalized now.'}
        </p>
    `;
}

function renderSessionHistory(persona) {
    const section = document.getElementById('sessionsSection');
    const sessions = GiftStorage.getSessionsByPersona(persona.id);

    if (sessions.length === 0) {
        section.innerHTML = `
            <div class="widget-empty">
                <div class="widget-empty-icon">📊</div>
                <p class="widget-empty-text">No sessions yet</p>
                <button class="widget-empty-btn" onclick="startDiscovery('${persona.id}')">
                    Start Discovery
                </button>
            </div>
        `;
        return;
    }

    section.innerHTML = sessions.map(session => `
        <div class="persona-session-card" onclick="viewSession('${session.id}')">
            <div class="persona-session-count">${session.likedGifts?.length || 0}</div>
            <div class="persona-session-info">
                <div class="persona-session-occasion">${session.occasion || 'Gift Discovery'}</div>
                <div class="persona-session-date">${GiftApp.formatDate(session.createdAt)}</div>
            </div>
        </div>
    `).join('');
}

// ==================== ACTIONS ====================
function viewPersona(id) {
    window.location.href = `view.html?id=${id}`;
}

function startDiscovery(personaId) {
    GiftStorage.setCurrentDiscovery({
        personaId: personaId,
        step: 'occasion'
    });
    window.location.href = '../discovery/occasion.html';
}

function viewSession(sessionId) {
    window.location.href = `../saved/index.html?session=${sessionId}`;
}

// ==================== DELETE MODAL ====================
function openDeleteModal(id, name) {
    deleteTargetId = id;
    document.getElementById('deletePersonaName').textContent = name;
    document.getElementById('deleteModal').classList.add('active');
}

function closeDeleteModal() {
    deleteTargetId = null;
    document.getElementById('deleteModal').classList.remove('active');
}

document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => {
    if (deleteTargetId) {
        GiftStorage.deletePersona(deleteTargetId);
        closeDeleteModal();
        GiftApp.showToast('Persona deleted', 'success');

        // Redirect or reload
        if (document.getElementById('personaGrid')) {
            loadPersonaList();
        } else {
            window.location.href = 'list.html';
        }
    }
});

// Close modal when clicking overlay
document.getElementById('deleteModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'deleteModal') {
        closeDeleteModal();
    }
});

// ==================== HELPERS ====================
function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getBudgetLabel(budget) {
    const labels = {
        'under25': 'Under $25',
        '25-50': '$25 - $50',
        '50-100': '$50 - $100',
        '100-200': '$100 - $200',
        '200plus': '$200+'
    };
    return labels[budget] || budget || 'Not set';
}

function calculateTrainingLevel(persona) {
    let level = 0;
    const fields = ['name', 'relationship', 'interests', 'style', 'budget'];

    fields.forEach(field => {
        if (persona[field]) {
            if (Array.isArray(persona[field]) && persona[field].length > 0) {
                level += 15;
            } else if (!Array.isArray(persona[field])) {
                level += 15;
            }
        }
    });

    // Add bonus for each discovery session
    const sessions = GiftStorage.getSessionsByPersona(persona.id);
    level = Math.min(100, level + (sessions.length * 10));

    return level;
}

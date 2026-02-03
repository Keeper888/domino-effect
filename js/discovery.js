/**
 * Gift Giver - Discovery Flow Logic
 * Handles occasion and budget selection
 */

const occasions = [
    { id: 'birthday', icon: '🎂', name: 'Birthday', date: 'Any time' },
    { id: 'valentines', icon: '❤️', name: "Valentine's Day", date: 'Feb 14' },
    { id: 'christmas', icon: '🎄', name: 'Christmas', date: 'Dec 25' },
    { id: 'anniversary', icon: '💍', name: 'Anniversary', date: 'Special date' },
    { id: 'mothers-day', icon: '💐', name: "Mother's Day", date: 'May 11' },
    { id: 'fathers-day', icon: '👔', name: "Father's Day", date: 'Jun 15' },
    { id: 'graduation', icon: '🎓', name: 'Graduation', date: 'Celebration' },
    { id: 'thank-you', icon: '🙏', name: 'Thank You', date: 'Appreciation' },
    { id: 'just-because', icon: '💝', name: 'Just Because', date: 'Any time' }
];

let selectedOccasion = null;
let selectedBudget = null;

document.addEventListener('DOMContentLoaded', () => {
    // Check for discovery state
    const discovery = GiftStorage.getCurrentDiscovery();

    if (!discovery || !discovery.personaId) {
        // No persona selected, redirect to persona selection
        window.location.href = 'select-persona.html';
        return;
    }

    // Load persona context
    loadPersonaContext(discovery.personaId);

    // Initialize based on page
    if (document.getElementById('occasionGrid')) {
        initOccasionPage(discovery);
    } else if (document.getElementById('budgetPills')) {
        initBudgetPage(discovery);
    }
});

function loadPersonaContext(personaId) {
    const persona = GiftStorage.getPersonaById(personaId);
    const contextEl = document.getElementById('personaContext');

    if (!persona || !contextEl) return;

    const emoji = GiftApp.getRelationshipEmoji(persona.relationship);

    contextEl.innerHTML = `
        <div class="persona-context-avatar">${emoji}</div>
        <div class="persona-context-info">
            <div class="persona-context-name">${persona.name}</div>
            <div class="persona-context-label">Shopping for</div>
        </div>
        <a href="../persona/list.html" class="persona-context-change">Change</a>
    `;
}

// ==================== OCCASION PAGE ====================
function initOccasionPage(discovery) {
    const grid = document.getElementById('occasionGrid');
    const continueBtn = document.getElementById('continueBtn');

    // Restore previous selection if any
    selectedOccasion = discovery.occasion || null;

    // Render occasions
    grid.innerHTML = occasions.map(occ => `
        <div class="occasion-card ${selectedOccasion === occ.id ? 'selected' : ''}"
             data-occasion="${occ.id}">
            <div class="occasion-card-icon">${occ.icon}</div>
            <div class="occasion-card-name">${occ.name}</div>
            <div class="occasion-card-date">${occ.date}</div>
        </div>
    `).join('');

    // Update continue button state
    updateContinueButton();

    // Handle clicks
    grid.addEventListener('click', (e) => {
        const card = e.target.closest('.occasion-card');
        if (!card) return;

        // Remove previous selection
        grid.querySelectorAll('.occasion-card').forEach(c => c.classList.remove('selected'));

        // Select new
        card.classList.add('selected');
        selectedOccasion = card.dataset.occasion;

        // Save to state
        const currentDiscovery = GiftStorage.getCurrentDiscovery();
        GiftStorage.setCurrentDiscovery({
            ...currentDiscovery,
            occasion: selectedOccasion
        });

        updateContinueButton();
    });

    // Continue button
    continueBtn.addEventListener('click', () => {
        if (selectedOccasion) {
            window.location.href = 'budget.html';
        }
    });
}

function updateContinueButton() {
    const btn = document.getElementById('continueBtn');
    if (btn) {
        btn.disabled = !selectedOccasion;
    }
}

// ==================== BUDGET PAGE ====================
function initBudgetPage(discovery) {
    const pills = document.getElementById('budgetPills');
    const startBtn = document.getElementById('startBtn');

    // Check if we have occasion selected
    if (!discovery.occasion) {
        window.location.href = 'occasion.html';
        return;
    }

    // Restore previous budget selection or use persona's budget
    const persona = GiftStorage.getPersonaById(discovery.personaId);
    selectedBudget = discovery.budget || persona?.budget || null;

    // Pre-select if we have a budget
    if (selectedBudget) {
        const pill = pills.querySelector(`[data-value="${selectedBudget}"]`);
        if (pill) {
            pill.classList.add('selected');
            updateStartButton();
        }
    }

    // Handle clicks
    pills.addEventListener('click', (e) => {
        const pill = e.target.closest('.budget-pill');
        if (!pill) return;

        // Remove previous selection
        pills.querySelectorAll('.budget-pill').forEach(p => p.classList.remove('selected'));

        // Select new
        pill.classList.add('selected');
        selectedBudget = pill.dataset.value;

        // Save to state
        const currentDiscovery = GiftStorage.getCurrentDiscovery();
        GiftStorage.setCurrentDiscovery({
            ...currentDiscovery,
            budget: selectedBudget
        });

        updateStartButton();
    });

    // Start button
    startBtn.addEventListener('click', () => {
        if (selectedBudget) {
            // Initialize gift discovery state
            const currentDiscovery = GiftStorage.getCurrentDiscovery();
            GiftStorage.setCurrentDiscovery({
                ...currentDiscovery,
                budget: selectedBudget,
                likedGifts: [],
                passedGifts: [],
                startedAt: new Date().toISOString()
            });

            window.location.href = 'grid.html';
        }
    });
}

function updateStartButton() {
    const btn = document.getElementById('startBtn');
    if (btn) {
        btn.disabled = !selectedBudget;
    }
}

/**
 * Gift Giver - Discovery Grid Logic
 * Handles gift browsing with like/pass functionality
 */

let gifts = [];
let likedGifts = [];
let passedGifts = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    // Check which page we're on
    if (document.getElementById('giftGrid')) {
        initGridPage();
    } else if (document.getElementById('resultsGrid')) {
        initResultsPage();
    }
});

// ==================== GRID PAGE ====================
function initGridPage() {
    const discovery = GiftStorage.getCurrentDiscovery();

    if (!discovery || !discovery.personaId) {
        window.location.href = 'select-persona.html';
        return;
    }

    // Load persona for title
    const persona = GiftStorage.getPersonaById(discovery.personaId);
    if (persona) {
        document.getElementById('gridTitle').textContent = `Gifts for ${persona.name}`;
    }

    // Load saved state
    likedGifts = discovery.likedGifts || [];
    passedGifts = discovery.passedGifts || [];

    // Get mock gifts
    gifts = GiftApp.getMockGifts(15);

    // Render grid
    renderGiftGrid();
    updateFooterStats();

    // Filter buttons
    document.querySelectorAll('.grid-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.grid-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderGiftGrid();
        });
    });

    // View results button
    document.getElementById('viewResultsBtn').addEventListener('click', () => {
        saveDiscoveryState();
        window.location.href = 'results.html';
    });
}

function renderGiftGrid() {
    const grid = document.getElementById('giftGrid');

    let filteredGifts = gifts;

    if (currentFilter === 'liked') {
        filteredGifts = gifts.filter(g => likedGifts.includes(g.id));
    } else if (currentFilter === 'new') {
        filteredGifts = gifts.filter(g => !likedGifts.includes(g.id) && !passedGifts.includes(g.id));
    }

    if (filteredGifts.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-icon">${currentFilter === 'liked' ? '❤️' : '🔍'}</div>
                <h3 class="empty-title">${currentFilter === 'liked' ? 'No liked gifts yet' : 'All gifts reviewed'}</h3>
                <p class="empty-text">${currentFilter === 'liked' ? 'Like some gifts to see them here!' : 'Great job! Check your results.'}</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filteredGifts.map(gift => {
        const isLiked = likedGifts.includes(gift.id);
        const isPassed = passedGifts.includes(gift.id);

        return `
            <div class="gift-grid-card ${isLiked ? 'liked' : ''} ${isPassed ? 'passed' : ''}" data-id="${gift.id}">
                <img src="${gift.image}" alt="${gift.title}" class="gift-grid-image">
                <div class="gift-grid-content">
                    <div class="gift-grid-price">$${gift.price}</div>
                    <div class="gift-grid-title">${gift.title}</div>
                    <div class="gift-grid-actions">
                        <button class="gift-action-btn pass" onclick="passGift(${gift.id})" ${isPassed ? 'disabled' : ''}>
                            ✕
                        </button>
                        <button class="gift-action-btn like" onclick="likeGift(${gift.id})" ${isLiked ? 'disabled' : ''}>
                            ❤️
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function likeGift(id) {
    if (!likedGifts.includes(id)) {
        likedGifts.push(id);

        // Remove from passed if it was there
        passedGifts = passedGifts.filter(g => g !== id);

        saveDiscoveryState();
        renderGiftGrid();
        updateFooterStats();

        // Visual feedback
        const card = document.querySelector(`[data-id="${id}"]`);
        if (card) {
            card.classList.add('liked');
        }
    }
}

function passGift(id) {
    if (!passedGifts.includes(id)) {
        passedGifts.push(id);

        // Remove from liked if it was there
        likedGifts = likedGifts.filter(g => g !== id);

        saveDiscoveryState();
        renderGiftGrid();
        updateFooterStats();
    }
}

function updateFooterStats() {
    document.getElementById('likedCount').textContent = likedGifts.length;
    document.getElementById('passedCount').textContent = passedGifts.length;
}

function saveDiscoveryState() {
    const discovery = GiftStorage.getCurrentDiscovery();
    GiftStorage.setCurrentDiscovery({
        ...discovery,
        likedGifts: likedGifts,
        passedGifts: passedGifts
    });
}

// ==================== RESULTS PAGE ====================
function initResultsPage() {
    const discovery = GiftStorage.getCurrentDiscovery();

    if (!discovery || !discovery.personaId) {
        window.location.href = 'select-persona.html';
        return;
    }

    // Load persona for context
    const persona = GiftStorage.getPersonaById(discovery.personaId);
    if (persona) {
        document.getElementById('resultsSubtitle').textContent =
            `Here are the gifts you loved for ${persona.name}`;
    }

    // Get liked gifts
    likedGifts = discovery.likedGifts || [];
    gifts = GiftApp.getMockGifts(15);

    const likedGiftData = gifts.filter(g => likedGifts.includes(g.id));

    // Update stats
    document.getElementById('likedCountStat').textContent = likedGiftData.length;

    const totalValue = likedGiftData.reduce((sum, g) => sum + g.price, 0);
    document.getElementById('totalValueStat').textContent = '$' + totalValue;

    // Show/hide elements
    const grid = document.getElementById('resultsGrid');
    const empty = document.getElementById('resultsEmpty');
    const actions = document.getElementById('resultsActions');

    if (likedGiftData.length === 0) {
        grid.classList.add('hidden');
        actions.classList.add('hidden');
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');

    // Render results grid
    grid.innerHTML = likedGiftData.map((gift, index) => `
        <div class="results-gift-card" data-id="${gift.id}">
            <span class="results-gift-badge">#${index + 1}</span>
            <button class="results-gift-remove" onclick="removeFromResults(${gift.id})">✕</button>
            <img src="${gift.image}" alt="${gift.title}" class="results-gift-image">
            <div class="results-gift-content">
                <div class="results-gift-price">$${gift.price}</div>
                <div class="results-gift-title">${gift.title}</div>
            </div>
        </div>
    `).join('');

    // Save session button
    document.getElementById('saveSessionBtn').addEventListener('click', saveSession);
}

function removeFromResults(id) {
    likedGifts = likedGifts.filter(g => g !== id);
    saveDiscoveryState();
    initResultsPage(); // Re-render
}

function saveSession() {
    const discovery = GiftStorage.getCurrentDiscovery();
    const persona = GiftStorage.getPersonaById(discovery.personaId);

    // Get occasion label
    const occasionLabels = {
        'birthday': 'Birthday',
        'valentines': "Valentine's Day",
        'christmas': 'Christmas',
        'anniversary': 'Anniversary',
        'mothers-day': "Mother's Day",
        'fathers-day': "Father's Day",
        'graduation': 'Graduation',
        'thank-you': 'Thank You',
        'just-because': 'Just Because'
    };

    // Create session
    const session = {
        personaId: discovery.personaId,
        occasion: occasionLabels[discovery.occasion] || discovery.occasion,
        budget: discovery.budget,
        likedGifts: discovery.likedGifts || [],
        startedAt: discovery.startedAt
    };

    GiftStorage.addSession(session);

    // Update persona training level
    if (persona) {
        const currentLevel = persona.trainingLevel || 0;
        GiftStorage.updatePersona(persona.id, {
            trainingLevel: Math.min(100, currentLevel + 10)
        });
    }

    // Clear discovery state
    GiftStorage.clearCurrentDiscovery();

    GiftApp.showToast('Session saved!', 'success');

    // Redirect to saved results
    setTimeout(() => {
        window.location.href = '../saved/index.html';
    }, 1000);
}

// Make functions globally available
window.likeGift = likeGift;
window.passGift = passGift;
window.removeFromResults = removeFromResults;

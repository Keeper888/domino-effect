/**
 * Dev Navigation Overlay
 * Floating sitemap for easy testing
 */

(function() {
    // Determine base path
    const path = window.location.pathname;
    let base = './';

    if (path.includes('/pages/auth/') || path.includes('/pages/persona/') ||
        path.includes('/pages/discovery/') || path.includes('/pages/saved/') ||
        path.includes('/pages/browse/')) {
        base = '../../';
    } else if (path.includes('/pages/')) {
        base = '../';
    }

    const pages = [
        { name: '🏠 Homepage', url: base + 'index.html' },
        { name: '─── Auth ───', url: '', header: true },
        { name: '📝 Sign Up', url: base + 'pages/auth/signup.html' },
        { name: '🔐 Login', url: base + 'pages/auth/login.html' },
        { name: '─── Main ───', url: '', header: true },
        { name: '📊 Dashboard', url: base + 'pages/dashboard.html' },
        { name: '🎯 Quiz', url: base + 'pages/quiz.html' },
        { name: '📅 Calendar', url: base + 'pages/calendar.html' },
        { name: '─── Personas ───', url: '', header: true },
        { name: '👥 Persona List', url: base + 'pages/persona/list.html' },
        { name: '👤 Persona View', url: base + 'pages/persona/view.html?id=test' },
        { name: '─── Discovery ───', url: '', header: true },
        { name: '👥 Select Persona', url: base + 'pages/discovery/select-persona.html' },
        { name: '🎉 Occasion', url: base + 'pages/discovery/occasion.html' },
        { name: '💰 Budget', url: base + 'pages/discovery/budget.html' },
        { name: '🎁 Grid', url: base + 'pages/discovery/grid.html' },
        { name: '✨ Results', url: base + 'pages/discovery/results.html' },
        { name: '─── Browse ───', url: '', header: true },
        { name: '🛍️ Browse', url: base + 'pages/browse/index.html' },
        { name: '📦 Category', url: base + 'pages/browse/category.html?cat=her' },
        { name: '💡 Ideas', url: base + 'pages/ideas.html' },
        { name: '💾 Saved', url: base + 'pages/saved/index.html' },
    ];

    // Create toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.innerHTML = '🗺️';
    toggleBtn.id = 'devNavToggle';
    toggleBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 99999;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        border: none;
        background: linear-gradient(180deg, #c94a4a 0%, #b73d3d 50%, #a83232 100%);
        color: white;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 4px 0 #6b1a1a, 0 6px 20px rgba(0,0,0,0.3);
        transition: all 0.2s ease;
    `;
    toggleBtn.onmouseenter = () => toggleBtn.style.transform = 'scale(1.1)';
    toggleBtn.onmouseleave = () => toggleBtn.style.transform = 'scale(1)';

    // Create panel
    const panel = document.createElement('div');
    panel.id = 'devNavPanel';
    panel.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        z-index: 99998;
        width: 220px;
        max-height: 70vh;
        background: white;
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        overflow: hidden;
        display: none;
        flex-direction: column;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        padding: 12px 16px;
        background: linear-gradient(135deg, #1565c0 0%, #c62828 100%);
        color: white;
        font-weight: 700;
        font-size: 14px;
    `;
    header.innerHTML = '🗺️ Dev Sitemap';

    // Quick actions
    const actions = document.createElement('div');
    actions.style.cssText = `
        padding: 8px;
        background: #f5f5f5;
        display: flex;
        gap: 8px;
        border-bottom: 1px solid #ddd;
    `;
    actions.innerHTML = `
        <button id="devCreateUser" style="flex:1; padding:6px; border:none; border-radius:8px; background:#4caf50; color:white; font-size:11px; cursor:pointer;">
            ✓ Create Test User
        </button>
        <button id="devClearData" style="flex:1; padding:6px; border:none; border-radius:8px; background:#ff9800; color:white; font-size:11px; cursor:pointer;">
            🗑️ Clear Data
        </button>
    `;

    // Links list
    const list = document.createElement('div');
    list.style.cssText = `
        overflow-y: auto;
        max-height: calc(70vh - 100px);
    `;

    pages.forEach(page => {
        const item = document.createElement('a');
        if (page.header) {
            item.style.cssText = `
                display: block;
                padding: 6px 16px;
                font-size: 10px;
                color: #888;
                text-align: center;
                background: #f9f9f9;
                text-decoration: none;
            `;
            item.textContent = page.name;
        } else {
            item.href = page.url;
            item.style.cssText = `
                display: block;
                padding: 10px 16px;
                font-size: 13px;
                color: #333;
                text-decoration: none;
                border-bottom: 1px solid #eee;
                transition: background 0.2s;
            `;
            item.textContent = page.name;
            item.onmouseenter = () => item.style.background = '#e3f2fd';
            item.onmouseleave = () => item.style.background = 'transparent';

            // Highlight current page
            if (window.location.href.includes(page.url.replace(base, '').split('?')[0])) {
                item.style.background = '#e3f2fd';
                item.style.fontWeight = '600';
            }
        }
        list.appendChild(item);
    });

    panel.appendChild(header);
    panel.appendChild(actions);
    panel.appendChild(list);

    document.body.appendChild(toggleBtn);
    document.body.appendChild(panel);

    // Toggle panel
    toggleBtn.onclick = () => {
        const isOpen = panel.style.display === 'flex';
        panel.style.display = isOpen ? 'none' : 'flex';
        toggleBtn.innerHTML = isOpen ? '🗺️' : '✕';
    };

    // Action handlers
    document.getElementById('devCreateUser').onclick = () => {
        const user = {
            id: 'test_user_123',
            email: 'test@example.com',
            name: 'Test User',
            createdAt: new Date().toISOString()
        };
        localStorage.setItem('giftgiver_user', JSON.stringify(user));

        // Create sample persona
        const personas = [{
            id: 'persona_1',
            name: 'Sarah',
            birthday: `${new Date().getFullYear()}-03-15`,
            relationship: 'partner',
            interests: ['cooking', 'travel', 'selfcare'],
            style: 'cozy',
            budget: '50-100',
            createdAt: new Date().toISOString(),
            trainingLevel: 45
        }];
        localStorage.setItem('giftgiver_personas', JSON.stringify(personas));

        alert('✓ Test user + sample persona created!\n\nEmail: test@example.com\nPersona: Sarah');
        location.reload();
    };

    document.getElementById('devClearData').onclick = () => {
        if (confirm('Clear all Gift Giver data?')) {
            localStorage.removeItem('giftgiver_user');
            localStorage.removeItem('giftgiver_personas');
            localStorage.removeItem('giftgiver_sessions');
            localStorage.removeItem('giftgiver_calendar');
            localStorage.removeItem('giftgiver_current_quiz');
            localStorage.removeItem('giftgiver_current_discovery');
            alert('✓ All data cleared!');
            location.reload();
        }
    };

    // Show status
    const user = localStorage.getItem('giftgiver_user');
    if (user) {
        header.innerHTML = '🗺️ Dev Sitemap <span style="font-size:10px; opacity:0.8;">(logged in)</span>';
    }
})();

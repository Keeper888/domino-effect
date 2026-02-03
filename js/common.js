/**
 * Gift Giver - Common JavaScript Utilities
 * Shared functions and authentication state management
 */

const GiftApp = {
    // ==================== INITIALIZATION ====================
    init() {
        this.setupNavigation();
        this.checkAuthState();
    },

    // ==================== NAVIGATION ====================
    setupNavigation() {
        // User dropdown toggle
        const userDropdown = document.querySelector('.user-dropdown');
        if (userDropdown) {
            const avatar = userDropdown.querySelector('.user-avatar');
            if (avatar) {
                avatar.addEventListener('click', (e) => {
                    e.stopPropagation();
                    userDropdown.classList.toggle('open');
                });
            }

            // Close dropdown when clicking outside
            document.addEventListener('click', () => {
                userDropdown.classList.remove('open');
            });
        }

        // Logout handler
        const logoutBtns = document.querySelectorAll('[data-action="logout"]');
        logoutBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        });

        // Mark active nav link
        this.setActiveNavLink();
    },

    setActiveNavLink() {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.navbar-auth .nav-link');

        navLinks.forEach(link => {
            link.classList.remove('active');
            const href = link.getAttribute('href');
            if (href && currentPath.includes(href.replace('../', '').replace('./', ''))) {
                link.classList.add('active');
            }
        });
    },

    // ==================== AUTHENTICATION ====================
    checkAuthState() {
        const user = GiftStorage.getUser();
        const requiresAuth = document.body.dataset.requiresAuth === 'true';
        const isAuthPage = document.body.dataset.authPage === 'true';

        if (requiresAuth && !user) {
            // Redirect to login if page requires auth
            window.location.href = this.getAuthUrl('login');
            return;
        }

        if (isAuthPage && user) {
            // Redirect to dashboard if already logged in
            window.location.href = this.getPageUrl('dashboard');
            return;
        }

        // Update UI with user info
        if (user) {
            this.updateUserUI(user);
        }
    },

    updateUserUI(user) {
        // Update avatar initials
        const avatars = document.querySelectorAll('.user-avatar');
        avatars.forEach(avatar => {
            if (!avatar.querySelector('img')) {
                avatar.textContent = this.getInitials(user.name);
            }
        });

        // Update username displays
        const userNames = document.querySelectorAll('[data-user-name]');
        userNames.forEach(el => {
            el.textContent = user.name;
        });

        // Update greeting
        const greetings = document.querySelectorAll('[data-greeting]');
        greetings.forEach(el => {
            el.textContent = this.getGreeting(user.name);
        });
    },

    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    },

    getGreeting(name) {
        const hour = new Date().getHours();
        let greeting;

        if (hour < 12) {
            greeting = 'Good morning';
        } else if (hour < 17) {
            greeting = 'Good afternoon';
        } else {
            greeting = 'Good evening';
        }

        return `${greeting}, ${name.split(' ')[0]}!`;
    },

    login(email, password, name = null) {
        // For MVP, we accept any valid email format
        // In production, this would validate against a backend
        const user = {
            id: GiftStorage.generateId(),
            email: email,
            name: name || email.split('@')[0],
            createdAt: new Date().toISOString()
        };

        GiftStorage.setUser(user);
        return user;
    },

    logout() {
        GiftStorage.clearUser();
        GiftStorage.clearCurrentQuiz();
        GiftStorage.clearCurrentDiscovery();
        window.location.href = this.getBaseUrl();
    },

    // ==================== URL HELPERS ====================
    getBaseUrl() {
        // Determine base URL based on current location
        const path = window.location.pathname;
        if (path.includes('/pages/')) {
            // Count directory depth
            const depth = (path.match(/\/pages\//g) || []).length;
            const parts = path.split('/pages/')[1];
            const subDirs = (parts.match(/\//g) || []).length;
            return '../'.repeat(subDirs + 1);
        }
        return './';
    },

    getPageUrl(page) {
        const base = this.getBaseUrl();
        const pages = {
            'home': 'index.html',
            'dashboard': 'pages/dashboard.html',
            'quiz': 'pages/quiz.html',
            'personas': 'pages/persona/list.html',
            'persona-view': 'pages/persona/view.html',
            'occasion': 'pages/discovery/occasion.html',
            'budget': 'pages/discovery/budget.html',
            'grid': 'pages/discovery/grid.html',
            'results': 'pages/discovery/results.html',
            'saved': 'pages/saved/index.html',
            'calendar': 'pages/calendar.html',
            'browse': 'pages/browse/index.html'
        };
        return base + (pages[page] || page);
    },

    getAuthUrl(page) {
        const base = this.getBaseUrl();
        return base + `pages/auth/${page}.html`;
    },

    // ==================== DATE UTILITIES ====================
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    },

    getDaysUntil(dateStr) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(dateStr);
        target.setHours(0, 0, 0, 0);

        const diff = target - today;
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return 'Today';
        if (days === 1) return 'Tomorrow';
        if (days < 0) return `${Math.abs(days)} days ago`;
        return `${days} days away`;
    },

    // ==================== FORM UTILITIES ====================
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    validatePassword(password) {
        return password && password.length >= 6;
    },

    showFormError(input, message) {
        const group = input.closest('.form-group');
        if (!group) return;

        input.classList.add('error');

        let errorEl = group.querySelector('.form-error');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'form-error';
            group.appendChild(errorEl);
        }
        errorEl.textContent = message;
    },

    clearFormError(input) {
        const group = input.closest('.form-group');
        if (!group) return;

        input.classList.remove('error');
        const errorEl = group.querySelector('.form-error');
        if (errorEl) {
            errorEl.remove();
        }
    },

    clearAllFormErrors(form) {
        const inputs = form.querySelectorAll('.form-input');
        inputs.forEach(input => this.clearFormError(input));
    },

    // ==================== UI UTILITIES ====================
    showToast(message, type = 'info') {
        // Remove existing toast
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-message">${message}</span>
            <button class="toast-close">&times;</button>
        `;

        // Add toast styles if not present
        if (!document.querySelector('#toast-styles')) {
            const styles = document.createElement('style');
            styles.id = 'toast-styles';
            styles.textContent = `
                .toast {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    padding: 12px 20px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    z-index: 9999;
                    animation: slideUp 0.3s ease;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                }
                .toast-info { background: #1565c0; color: white; }
                .toast-success { background: #2e7d32; color: white; }
                .toast-error { background: #c62828; color: white; }
                .toast-close {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    opacity: 0.8;
                }
                .toast-close:hover { opacity: 1; }
                @keyframes slideUp {
                    from { transform: translateX(-50%) translateY(100px); opacity: 0; }
                    to { transform: translateX(-50%) translateY(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(toast);

        // Auto dismiss
        setTimeout(() => {
            toast.style.animation = 'slideUp 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);

        // Manual close
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });
    },

    // Loading state for buttons
    setButtonLoading(button, loading = true) {
        if (loading) {
            button.dataset.originalText = button.textContent;
            button.textContent = 'Loading...';
            button.disabled = true;
            button.style.opacity = '0.7';
        } else {
            button.textContent = button.dataset.originalText || button.textContent;
            button.disabled = false;
            button.style.opacity = '1';
        }
    },

    // ==================== MOCK DATA ====================
    getMockGifts(count = 12) {
        const gifts = [
            { id: 1, title: 'Spa Gift Set', price: 45, image: 'https://via.placeholder.com/280x180/e3f2fd/1976d2?text=Spa+Set', category: 'self-care' },
            { id: 2, title: 'Wireless Earbuds', price: 79, image: 'https://via.placeholder.com/280x180/e3f2fd/1976d2?text=Earbuds', category: 'tech' },
            { id: 3, title: 'Chocolate Box', price: 35, image: 'https://via.placeholder.com/280x180/e3f2fd/1976d2?text=Chocolate', category: 'treats' },
            { id: 4, title: 'Watch Box', price: 89, image: 'https://via.placeholder.com/280x180/e3f2fd/1976d2?text=Watch+Box', category: 'accessories' },
            { id: 5, title: 'Perfume Set', price: 65, image: 'https://via.placeholder.com/280x180/e3f2fd/1976d2?text=Perfume', category: 'self-care' },
            { id: 6, title: 'Art Supply Kit', price: 55, image: 'https://via.placeholder.com/280x180/e3f2fd/1976d2?text=Art+Kit', category: 'creative' },
            { id: 7, title: 'Cozy Blanket', price: 49, image: 'https://via.placeholder.com/280x180/e3f2fd/1976d2?text=Blanket', category: 'home' },
            { id: 8, title: 'Book Collection', price: 42, image: 'https://via.placeholder.com/280x180/e3f2fd/1976d2?text=Books', category: 'books' },
            { id: 9, title: 'Jewelry Box', price: 38, image: 'https://via.placeholder.com/280x180/e3f2fd/1976d2?text=Jewelry', category: 'accessories' },
            { id: 10, title: 'Candle Set', price: 32, image: 'https://via.placeholder.com/280x180/e3f2fd/1976d2?text=Candles', category: 'home' },
            { id: 11, title: 'Gaming Headset', price: 95, image: 'https://via.placeholder.com/280x180/e3f2fd/1976d2?text=Headset', category: 'tech' },
            { id: 12, title: 'Yoga Mat Set', price: 58, image: 'https://via.placeholder.com/280x180/e3f2fd/1976d2?text=Yoga+Mat', category: 'fitness' },
            { id: 13, title: 'Coffee Maker', price: 75, image: 'https://via.placeholder.com/280x180/e3f2fd/1976d2?text=Coffee', category: 'home' },
            { id: 14, title: 'Smart Watch', price: 199, image: 'https://via.placeholder.com/280x180/e3f2fd/1976d2?text=Smart+Watch', category: 'tech' },
            { id: 15, title: 'Plant Set', price: 45, image: 'https://via.placeholder.com/280x180/e3f2fd/1976d2?text=Plants', category: 'home' },
        ];
        return gifts.slice(0, count);
    },

    getRelationshipEmoji(relationship) {
        const emojis = {
            'partner': '💕',
            'friend': '🤝',
            'family': '👨‍👩‍👧‍👦',
            'child': '👶',
            'colleague': '💼',
            'special': '✨'
        };
        return emojis[relationship] || '🎁';
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    GiftApp.init();
});

// Make available globally
window.GiftApp = GiftApp;

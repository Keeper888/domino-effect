/**
 * Gift Giver - Authentication Logic
 * Handles signup and login forms
 */

document.addEventListener('DOMContentLoaded', () => {
    initSignupForm();
    initLoginForm();
    initPasswordStrength();
});

function initSignupForm() {
    const form = document.getElementById('signupForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        GiftApp.clearAllFormErrors(form);

        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const terms = document.getElementById('terms').checked;

        // Validation
        let hasErrors = false;

        if (!name || name.length < 2) {
            GiftApp.showFormError(document.getElementById('name'), 'Please enter your name');
            hasErrors = true;
        }

        if (!GiftApp.validateEmail(email)) {
            GiftApp.showFormError(document.getElementById('email'), 'Please enter a valid email');
            hasErrors = true;
        }

        if (!GiftApp.validatePassword(password)) {
            GiftApp.showFormError(document.getElementById('password'), 'Password must be at least 6 characters');
            hasErrors = true;
        }

        if (!terms) {
            GiftApp.showToast('Please accept the terms and conditions', 'error');
            hasErrors = true;
        }

        if (hasErrors) return;

        // Create user
        const submitBtn = form.querySelector('button[type="submit"]');
        GiftApp.setButtonLoading(submitBtn, true);

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 800));

        try {
            const user = GiftApp.login(email, password, name);
            GiftApp.showToast('Account created successfully!', 'success');

            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = '../dashboard.html';
            }, 500);
        } catch (error) {
            GiftApp.showToast('Something went wrong. Please try again.', 'error');
            GiftApp.setButtonLoading(submitBtn, false);
        }
    });
}

function initLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        GiftApp.clearAllFormErrors(form);

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        // Validation
        let hasErrors = false;

        if (!GiftApp.validateEmail(email)) {
            GiftApp.showFormError(document.getElementById('email'), 'Please enter a valid email');
            hasErrors = true;
        }

        if (!password) {
            GiftApp.showFormError(document.getElementById('password'), 'Please enter your password');
            hasErrors = true;
        }

        if (hasErrors) return;

        // Login user
        const submitBtn = form.querySelector('button[type="submit"]');
        GiftApp.setButtonLoading(submitBtn, true);

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 800));

        try {
            // For MVP, accept any valid email/password combo
            const user = GiftApp.login(email, password);
            GiftApp.showToast('Welcome back!', 'success');

            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = '../dashboard.html';
            }, 500);
        } catch (error) {
            GiftApp.showToast('Invalid email or password', 'error');
            GiftApp.setButtonLoading(submitBtn, false);
        }
    });
}

function initPasswordStrength() {
    const passwordInput = document.getElementById('password');
    const strengthContainer = document.getElementById('passwordStrength');

    if (!passwordInput || !strengthContainer) return;

    passwordInput.addEventListener('input', () => {
        const password = passwordInput.value;

        if (password.length === 0) {
            strengthContainer.style.display = 'none';
            return;
        }

        strengthContainer.style.display = 'block';

        const strength = calculatePasswordStrength(password);
        updateStrengthUI(strength);
    });
}

function calculatePasswordStrength(password) {
    let score = 0;

    // Length
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;

    // Character variety
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    // Return strength level
    if (score <= 2) return { level: 1, text: 'Weak', class: 'weak' };
    if (score <= 4) return { level: 2, text: 'Fair', class: 'weak' };
    if (score <= 5) return { level: 3, text: 'Good', class: 'medium' };
    return { level: 4, text: 'Strong', class: 'strong' };
}

function updateStrengthUI(strength) {
    const segments = ['seg1', 'seg2', 'seg3', 'seg4'];
    const strengthText = document.getElementById('strengthText');

    segments.forEach((segId, index) => {
        const segment = document.getElementById(segId);
        segment.className = 'strength-segment';

        if (index < strength.level) {
            segment.classList.add('active', strength.class);
        }
    });

    if (strengthText) {
        strengthText.textContent = strength.text + ' password';
    }
}

// Social login handlers (placeholder for future implementation)
document.querySelectorAll('.auth-social-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        GiftApp.showToast('Social login coming soon!', 'info');
    });
});

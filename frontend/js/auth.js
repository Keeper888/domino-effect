/**
 * Gift Giver - Authentication Logic
 * Handles signup and login forms with Supabase Auth
 */

document.addEventListener('DOMContentLoaded', () => {
    initSignupForm();
    initLoginForm();
    initPasswordStrength();
    initSocialLogin();
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

        const submitBtn = form.querySelector('button[type="submit"]');
        GiftApp.setButtonLoading(submitBtn, true);

        try {
            // Try Supabase auth if configured
            if (GiftConfig.isConfigured() && GiftSupabase.client) {
                const { data, error } = await GiftSupabase.signUp(email, password, name);

                if (error) {
                    throw new Error(error.message);
                }

                // Check if email confirmation is required
                if (data.user && !data.session) {
                    GiftApp.showToast('Check your email to confirm your account!', 'success');
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 2000);
                    return;
                }

                GiftApp.showToast('Account created successfully!', 'success');
            } else {
                // Fallback to localStorage for offline mode
                const user = {
                    id: GiftStorage.generateId(),
                    email: email,
                    name: name,
                    createdAt: new Date().toISOString()
                };
                GiftStorage.setUser(user);
                GiftApp.showToast('Account created (offline mode)', 'success');
            }

            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = '../dashboard.html';
            }, 500);

        } catch (error) {
            console.error('[Auth] Signup error:', error);

            // Handle specific Supabase errors
            let errorMessage = 'Something went wrong. Please try again.';

            if (error.message.includes('already registered')) {
                errorMessage = 'This email is already registered. Try logging in.';
            } else if (error.message.includes('password')) {
                errorMessage = 'Password is too weak. Use at least 6 characters.';
            } else if (error.message.includes('email')) {
                errorMessage = 'Please enter a valid email address.';
            }

            GiftApp.showToast(errorMessage, 'error');
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
        const remember = document.getElementById('remember')?.checked || false;

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

        const submitBtn = form.querySelector('button[type="submit"]');
        GiftApp.setButtonLoading(submitBtn, true);

        try {
            // Try Supabase auth if configured
            if (GiftConfig.isConfigured() && GiftSupabase.client) {
                const { data, error } = await GiftSupabase.signIn(email, password);

                if (error) {
                    throw new Error(error.message);
                }

                GiftApp.showToast('Welcome back!', 'success');

                // Store remember preference
                if (remember) {
                    localStorage.setItem('giftgiver_remember', 'true');
                }
            } else {
                // Fallback to localStorage for offline mode
                const user = {
                    id: GiftStorage.generateId(),
                    email: email,
                    name: email.split('@')[0],
                    createdAt: new Date().toISOString()
                };
                GiftStorage.setUser(user);
                GiftApp.showToast('Welcome back! (offline mode)', 'success');
            }

            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = '../dashboard.html';
            }, 500);

        } catch (error) {
            console.error('[Auth] Login error:', error);

            // Handle specific Supabase errors
            let errorMessage = 'Invalid email or password';

            if (error.message.includes('Email not confirmed')) {
                errorMessage = 'Please confirm your email before logging in.';
            } else if (error.message.includes('Invalid login')) {
                errorMessage = 'Invalid email or password. Please try again.';
            }

            GiftApp.showToast(errorMessage, 'error');
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
        if (!segment) return;

        segment.className = 'strength-segment';

        if (index < strength.level) {
            segment.classList.add('active', strength.class);
        }
    });

    if (strengthText) {
        strengthText.textContent = strength.text + ' password';
    }
}

function initSocialLogin() {
    // Google OAuth handler
    document.querySelectorAll('.auth-social-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!GiftConfig.isConfigured() || !GiftSupabase.client) {
                GiftApp.showToast('Social login requires online connection', 'info');
                return;
            }

            try {
                const { data, error } = await GiftSupabase.client.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: window.location.origin + '/pages/dashboard.html'
                    }
                });

                if (error) {
                    throw error;
                }

                // Redirect happens automatically
            } catch (error) {
                console.error('[Auth] Social login error:', error);
                GiftApp.showToast('Social login failed. Try email signup.', 'error');
            }
        });
    });
}

// Password reset handler
async function resetPassword(email) {
    if (!GiftConfig.isConfigured() || !GiftSupabase.client) {
        GiftApp.showToast('Password reset requires online connection', 'info');
        return;
    }

    try {
        const { error } = await GiftSupabase.client.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/pages/auth/reset-password.html'
        });

        if (error) {
            throw error;
        }

        GiftApp.showToast('Check your email for reset instructions', 'success');
    } catch (error) {
        console.error('[Auth] Password reset error:', error);
        GiftApp.showToast('Failed to send reset email', 'error');
    }
}

// Make reset function available globally
window.resetPassword = resetPassword;

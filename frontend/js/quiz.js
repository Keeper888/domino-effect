/**
 * Gift Giver - Quiz Wizard Logic
 * 7-question persona creation wizard with OCEAN psychology scoring
 */

const QuizWizard = {
    currentStep: 1,
    totalSteps: 8,
    answers: {},

    questions: [
        {
            id: 'name',
            type: 'text',
            icon: '❤️',
            title: "Who's the lucky person?",
            subtitle: "Enter the name of who you're shopping for",
            placeholder: "Enter their name..."
        },
        {
            id: 'birthday',
            type: 'birthday',
            icon: '🎂',
            title: "When is {name}'s birthday?",
            subtitle: "We'll remind you when it's coming up (optional)",
            months: [
                { value: '01', label: 'January' },
                { value: '02', label: 'February' },
                { value: '03', label: 'March' },
                { value: '04', label: 'April' },
                { value: '05', label: 'May' },
                { value: '06', label: 'June' },
                { value: '07', label: 'July' },
                { value: '08', label: 'August' },
                { value: '09', label: 'September' },
                { value: '10', label: 'October' },
                { value: '11', label: 'November' },
                { value: '12', label: 'December' }
            ]
        },
        {
            id: 'relationship',
            type: 'single',
            icon: '🤝',
            title: "How do you know {name}?",
            subtitle: "Select your relationship",
            options: [
                { value: 'partner', icon: '💕', label: 'Partner', desc: 'Spouse, boyfriend, girlfriend' },
                { value: 'friend', icon: '🤝', label: 'Friend', desc: 'Close friend or bestie' },
                { value: 'family', icon: '👨‍👩‍👧‍👦', label: 'Family', desc: 'Parent, sibling, relative' },
                { value: 'child', icon: '👶', label: 'Child', desc: 'Son, daughter, or kid' },
                { value: 'colleague', icon: '💼', label: 'Colleague', desc: 'Coworker or boss' },
                { value: 'special', icon: '✨', label: 'Someone Special', desc: 'Secret crush or other' }
            ],
            cols: 3
        },
        {
            id: 'activities',
            type: 'multi',
            icon: '🎯',
            title: "It's Saturday afternoon. Where would you find {name}?",
            subtitle: "Select 1-4 activities they enjoy",
            maxSelect: 4,
            options: [
                { value: 'gaming', icon: '🎮', label: 'Gaming', ocean: { O: 10, E: -10 } },
                { value: 'music', icon: '🎵', label: 'Music', ocean: { O: 15, E: 5 } },
                { value: 'cooking', icon: '👨‍🍳', label: 'Cooking', ocean: { O: 10, C: 10 } },
                { value: 'travel', icon: '✈️', label: 'Travel', ocean: { O: 20, E: 15 } },
                { value: 'tech', icon: '💻', label: 'Tech', ocean: { O: 15, C: 5 } },
                { value: 'fitness', icon: '🧘', label: 'Yoga/Gym', ocean: { C: 15, E: 5 } },
                { value: 'pets', icon: '🐕', label: 'With Pets', ocean: { A: 15, N: -5 } },
                { value: 'shopping', icon: '🛍️', label: 'Shopping', ocean: { E: 10, O: 5 } }
            ],
            cols: 4
        },
        {
            id: 'giftTypes',
            type: 'multi',
            icon: '🎁',
            title: "What would make {name} light up?",
            subtitle: "Select up to 3 gift types they'd love",
            maxSelect: 3,
            options: [
                { value: 'books', icon: '📚', label: 'Books/Journals', ocean: { O: 15, C: 10, E: -5 } },
                { value: 'selfcare', icon: '🧴', label: 'Self-care', ocean: { A: 10, N: -10 } },
                { value: 'gadgets', icon: '🔌', label: 'Cool Gadgets', ocean: { O: 20, C: 5 } },
                { value: 'jewelry', icon: '💎', label: 'Jewelry', ocean: { E: 5, A: 5 } },
                { value: 'experiences', icon: '🎟️', label: 'Experiences', ocean: { O: 20, E: 20 } },
                { value: 'treats', icon: '🍫', label: 'Treats & Sweets', ocean: { A: 10, E: 5 } }
            ],
            cols: 3
        },
        {
            id: 'style',
            type: 'single',
            icon: '🎨',
            title: "Which vibe matches {name} best?",
            subtitle: "Select their aesthetic style",
            isStyle: true,
            options: [
                { value: 'minimal', icon: '⬜', label: 'Minimal', ocean: { C: 15, O: -5 } },
                { value: 'cozy', icon: '🧸', label: 'Cozy', ocean: { A: 15, N: 5 } },
                { value: 'modern', icon: '🔲', label: 'Modern', ocean: { O: 10, C: 10 } },
                { value: 'vintage', icon: '📻', label: 'Vintage', ocean: { O: 15, N: 5 } },
                { value: 'boho', icon: '🌻', label: 'Boho', ocean: { O: 20, A: 10 } },
                { value: 'kawaii', icon: '🌸', label: 'Kawaii', ocean: { E: 10, A: 15 } },
                { value: 'elegant', icon: '✨', label: 'Elegant', ocean: { C: 10, E: 5 } },
                { value: 'rustic', icon: '🪵', label: 'Rustic', ocean: { A: 10, C: 5 } }
            ]
        },
        {
            id: 'budget',
            type: 'budget',
            icon: '💰',
            title: "What's your gift budget?",
            subtitle: "This helps us show relevant gift options",
            options: [
                { value: 'under25', label: 'Under $25' },
                { value: '25-50', label: '$25 - $50' },
                { value: '50-100', label: '$50 - $100' },
                { value: '100-200', label: '$100 - $200' },
                { value: '200plus', label: '$200+' }
            ]
        },
        {
            id: 'summary',
            type: 'summary',
            icon: '🎉',
            title: "Perfect! Here's {name}'s gift profile",
            subtitle: "Review the details and let's find some gifts!"
        }
    ],

    // ==================== PSYCHOLOGY SCORING ====================

    // Calculate OCEAN scores from quiz answers
    calculateOCEAN() {
        // Start with baseline scores (50 = neutral)
        const scores = {
            openness: 50,           // O - Openness to Experience
            conscientiousness: 50,  // C - Conscientiousness
            extraversion: 50,       // E - Extraversion
            agreeableness: 50,      // A - Agreeableness
            neuroticism: 50         // N - Neuroticism
        };

        // Map short keys to full names
        const keyMap = { O: 'openness', C: 'conscientiousness', E: 'extraversion', A: 'agreeableness', N: 'neuroticism' };

        // Process activities
        const activities = this.answers.activities || [];
        const activityQuestion = this.questions.find(q => q.id === 'activities');
        activities.forEach(act => {
            const option = activityQuestion.options.find(o => o.value === act);
            if (option?.ocean) {
                Object.entries(option.ocean).forEach(([key, value]) => {
                    scores[keyMap[key]] = Math.max(0, Math.min(100, scores[keyMap[key]] + value));
                });
            }
        });

        // Process gift types
        const giftTypes = this.answers.giftTypes || [];
        const giftQuestion = this.questions.find(q => q.id === 'giftTypes');
        giftTypes.forEach(gift => {
            const option = giftQuestion.options.find(o => o.value === gift);
            if (option?.ocean) {
                Object.entries(option.ocean).forEach(([key, value]) => {
                    scores[keyMap[key]] = Math.max(0, Math.min(100, scores[keyMap[key]] + value));
                });
            }
        });

        // Process style
        const style = this.answers.style;
        if (style) {
            const styleQuestion = this.questions.find(q => q.id === 'style');
            const styleOption = styleQuestion.options.find(o => o.value === style);
            if (styleOption?.ocean) {
                Object.entries(styleOption.ocean).forEach(([key, value]) => {
                    scores[keyMap[key]] = Math.max(0, Math.min(100, scores[keyMap[key]] + value));
                });
            }
        }

        // Clamp all values between 0 and 100
        Object.keys(scores).forEach(key => {
            scores[key] = Math.max(0, Math.min(100, Math.round(scores[key])));
        });

        return scores;
    },

    // Infer MBTI type from OCEAN scores
    inferMBTI(ocean) {
        // MBTI inference based on OCEAN correlations
        // E/I: Extraversion dimension
        const e_i = ocean.extraversion >= 50 ? 'E' : 'I';

        // S/N: Openness correlates with Intuition
        const s_n = ocean.openness >= 55 ? 'N' : 'S';

        // T/F: Agreeableness correlates with Feeling
        const t_f = ocean.agreeableness >= 55 ? 'F' : 'T';

        // J/P: Conscientiousness correlates with Judging
        const j_p = ocean.conscientiousness >= 55 ? 'J' : 'P';

        return e_i + s_n + t_f + j_p;
    },

    // Calculate confidence score based on answer diversity
    calculateConfidence() {
        let confidence = 50; // Base confidence

        // More activities selected = higher confidence
        const activities = this.answers.activities || [];
        confidence += activities.length * 5;

        // More gift types = higher confidence
        const giftTypes = this.answers.giftTypes || [];
        confidence += giftTypes.length * 5;

        // Style selected = +10
        if (this.answers.style) confidence += 10;

        // Budget selected = +5
        if (this.answers.budget) confidence += 5;

        return Math.min(100, confidence);
    },

    // ==================== INITIALIZATION ====================

    init() {
        // Load any saved quiz state
        const saved = GiftStorage.getCurrentQuiz();
        if (saved) {
            this.answers = saved.answers || {};
            this.currentStep = saved.step || 1;
        }

        this.render();
        this.bindEvents();
    },

    render() {
        const question = this.questions[this.currentStep - 1];
        const quizCard = document.getElementById('quizCard');

        // Update progress
        document.getElementById('currentStep').textContent = this.currentStep;
        document.getElementById('progressPercent').textContent = Math.round((this.currentStep / this.totalSteps) * 100);
        document.getElementById('progressFill').style.width = `${(this.currentStep / this.totalSteps) * 100}%`;

        // Update nav buttons
        document.getElementById('prevBtn').disabled = this.currentStep === 1;

        const nextBtn = document.getElementById('nextBtn');
        if (this.currentStep === this.totalSteps) {
            nextBtn.innerHTML = '🎁 Show Me Gifts!';
            nextBtn.className = 'btn btn-start quiz-nav-next anim-glow';
        } else {
            nextBtn.innerHTML = 'Next <span>→</span>';
            nextBtn.className = 'btn btn-primary quiz-nav-next';
        }

        // Replace {name} placeholder in titles
        const name = this.answers.name || 'them';
        const title = question.title.replace('{name}', name);
        const subtitle = question.subtitle?.replace('{name}', name) || '';

        // Render question content
        let content = '';

        switch (question.type) {
            case 'text':
                content = this.renderTextQuestion(question);
                break;
            case 'birthday':
                content = this.renderBirthdayQuestion(question);
                break;
            case 'single':
                content = this.renderSingleQuestion(question);
                break;
            case 'multi':
                content = this.renderMultiQuestion(question);
                break;
            case 'budget':
                content = this.renderBudgetQuestion(question);
                break;
            case 'summary':
                content = this.renderSummary();
                break;
        }

        quizCard.innerHTML = `
            <div class="quiz-question-header">
                <span class="quiz-question-icon">${question.icon}</span>
                <h2 class="quiz-question-title">${title}</h2>
                <p class="quiz-question-subtitle">${subtitle}</p>
            </div>
            ${content}
        `;

        // Animate card
        quizCard.classList.remove('quiz-celebrate');
        void quizCard.offsetWidth; // Trigger reflow
        quizCard.style.animation = 'none';
        void quizCard.offsetWidth;
        quizCard.style.animation = '';

        // Focus input if text question
        if (question.type === 'text') {
            setTimeout(() => {
                const input = document.getElementById('quizInput');
                if (input) input.focus();
            }, 100);
        }
    },

    renderTextQuestion(question) {
        const value = this.answers[question.id] || '';
        return `
            <div class="quiz-input-wrapper">
                <input
                    type="text"
                    id="quizInput"
                    class="quiz-input"
                    placeholder="${question.placeholder}"
                    value="${value}"
                    autocomplete="off"
                >
            </div>
        `;
    },

    renderBirthdayQuestion(question) {
        const saved = this.answers.birthday || {};
        const selectedMonth = saved.month || '';
        const selectedDay = saved.day || '';

        return `
            <div class="quiz-birthday-wrapper">
                <div class="quiz-birthday-selects">
                    <select id="birthdayMonth" class="quiz-birthday-select">
                        <option value="">Month</option>
                        ${question.months.map(m => `
                            <option value="${m.value}" ${selectedMonth === m.value ? 'selected' : ''}>${m.label}</option>
                        `).join('')}
                    </select>
                    <select id="birthdayDay" class="quiz-birthday-select">
                        <option value="">Day</option>
                        ${Array.from({length: 31}, (_, i) => i + 1).map(d => `
                            <option value="${String(d).padStart(2, '0')}" ${selectedDay === String(d).padStart(2, '0') ? 'selected' : ''}>${d}</option>
                        `).join('')}
                    </select>
                </div>
                <button type="button" class="quiz-skip-btn" id="skipBirthdayBtn">
                    Skip for now
                </button>
            </div>
        `;
    },

    renderSingleQuestion(question) {
        const selected = this.answers[question.id];
        const colsClass = question.isStyle ? '' : `cols-${question.cols || 2}`;

        if (question.isStyle) {
            return `
                <div class="quiz-style-grid">
                    ${question.options.map(opt => `
                        <div class="quiz-style-card ${selected === opt.value ? 'selected' : ''}"
                             data-value="${opt.value}">
                            <span class="quiz-style-icon">${opt.icon}</span>
                            <span class="quiz-style-name">${opt.label}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        return `
            <div class="quiz-options-grid ${colsClass}">
                ${question.options.map(opt => `
                    <div class="quiz-option-card ${selected === opt.value ? 'selected' : ''}"
                         data-value="${opt.value}">
                        <span class="quiz-option-icon">${opt.icon}</span>
                        <span class="quiz-option-label">${opt.label}</span>
                        ${opt.desc ? `<span class="quiz-option-desc">${opt.desc}</span>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderMultiQuestion(question) {
        const selected = this.answers[question.id] || [];

        return `
            <p class="quiz-multi-hint">Select up to ${question.maxSelect} options</p>
            <div class="quiz-options-grid cols-${question.cols || 2}">
                ${question.options.map(opt => `
                    <div class="quiz-option-card ${selected.includes(opt.value) ? 'selected' : ''}"
                         data-value="${opt.value}">
                        <span class="quiz-option-icon">${opt.icon}</span>
                        <span class="quiz-option-label">${opt.label}</span>
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderBudgetQuestion(question) {
        const selected = this.answers[question.id];

        return `
            <div class="quiz-budget-group">
                ${question.options.map(opt => `
                    <button class="quiz-budget-pill ${selected === opt.value ? 'selected' : ''}"
                            data-value="${opt.value}">
                        ${opt.label}
                    </button>
                `).join('')}
            </div>
        `;
    },

    renderSummary() {
        const name = this.answers.name || 'Unknown';
        const birthday = this.answers.birthday;
        const relationship = this.answers.relationship || 'special';
        const activities = this.answers.activities || [];
        const giftTypes = this.answers.giftTypes || [];
        const style = this.answers.style || 'modern';
        const budget = this.answers.budget || '50-100';

        const emoji = GiftApp.getRelationshipEmoji(relationship);
        const relationshipLabel = this.getOptionLabel('relationship', relationship);
        const styleLabel = this.getOptionLabel('style', style);
        const budgetLabel = this.getOptionLabel('budget', budget);

        // Calculate psychology preview
        const ocean = this.calculateOCEAN();
        const mbti = this.inferMBTI(ocean);

        // Format birthday display
        let birthdayDisplay = '';
        if (birthday && birthday.month && birthday.day) {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthIndex = parseInt(birthday.month) - 1;
            birthdayDisplay = `${monthNames[monthIndex]} ${parseInt(birthday.day)}`;
        }

        const allInterests = [...activities, ...giftTypes].map(i =>
            this.getOptionLabel('activities', i) || this.getOptionLabel('giftTypes', i) || i
        );

        return `
            <div class="quiz-summary">
                <div class="quiz-summary-header">
                    <div class="quiz-summary-avatar">${emoji}</div>
                    <div>
                        <div class="quiz-summary-name">${name}</div>
                        <div class="quiz-summary-relationship">${relationshipLabel}</div>
                        ${birthdayDisplay ? `<div class="quiz-summary-birthday">🎂 ${birthdayDisplay}</div>` : ''}
                    </div>
                </div>

                <div class="quiz-summary-section">
                    <div class="quiz-summary-label">Interests</div>
                    <div class="quiz-summary-tags">
                        ${allInterests.map(i => `<span class="quiz-summary-tag">${i}</span>`).join('')}
                    </div>
                </div>

                <div class="quiz-summary-section">
                    <div class="quiz-summary-label">Style</div>
                    <div class="quiz-summary-value">${styleLabel}</div>
                </div>

                <div class="quiz-summary-section">
                    <div class="quiz-summary-label">Budget</div>
                    <div class="quiz-summary-value">${budgetLabel}</div>
                </div>

                <div class="quiz-summary-section quiz-psychology-preview">
                    <div class="quiz-summary-label">Personality Insights</div>
                    <div class="quiz-psychology-badge">
                        <span class="mbti-type">${mbti}</span>
                        <span class="mbti-label">Inferred Type</span>
                    </div>
                    <div class="ocean-bars">
                        <div class="ocean-bar"><span>O</span><div class="bar"><div class="fill" style="width:${ocean.openness}%"></div></div></div>
                        <div class="ocean-bar"><span>C</span><div class="bar"><div class="fill" style="width:${ocean.conscientiousness}%"></div></div></div>
                        <div class="ocean-bar"><span>E</span><div class="bar"><div class="fill" style="width:${ocean.extraversion}%"></div></div></div>
                        <div class="ocean-bar"><span>A</span><div class="bar"><div class="fill" style="width:${ocean.agreeableness}%"></div></div></div>
                        <div class="ocean-bar"><span>N</span><div class="bar"><div class="fill" style="width:${ocean.neuroticism}%"></div></div></div>
                    </div>
                </div>
            </div>
        `;
    },

    getOptionLabel(questionId, value) {
        const question = this.questions.find(q => q.id === questionId);
        if (!question || !question.options) return value;
        const option = question.options.find(o => o.value === value);
        return option ? option.label : value;
    },

    bindEvents() {
        // Next button
        document.getElementById('nextBtn').addEventListener('click', () => this.next());

        // Previous button
        document.getElementById('prevBtn').addEventListener('click', () => this.prev());

        // Delegate option clicks
        document.getElementById('quizCard').addEventListener('click', (e) => {
            const card = e.target.closest('.quiz-option-card, .quiz-style-card, .quiz-budget-pill');
            if (card) {
                this.handleOptionClick(card);
            }
        });

        // Handle text input
        document.getElementById('quizCard').addEventListener('input', (e) => {
            if (e.target.id === 'quizInput') {
                const question = this.questions[this.currentStep - 1];
                this.answers[question.id] = e.target.value;
                this.saveState();
            }
        });

        // Handle birthday selects
        document.getElementById('quizCard').addEventListener('change', (e) => {
            if (e.target.id === 'birthdayMonth' || e.target.id === 'birthdayDay') {
                const month = document.getElementById('birthdayMonth')?.value || '';
                const day = document.getElementById('birthdayDay')?.value || '';
                this.answers.birthday = { month, day };
                this.saveState();
            }
        });

        // Skip birthday button
        document.getElementById('quizCard').addEventListener('click', (e) => {
            if (e.target.id === 'skipBirthdayBtn') {
                this.answers.birthday = null;
                this.saveState();
                this.next();
            }
        });

        // Enter key for text input
        document.getElementById('quizCard').addEventListener('keydown', (e) => {
            if (e.target.id === 'quizInput' && e.key === 'Enter') {
                this.next();
            }
        });
    },

    handleOptionClick(card) {
        const value = card.dataset.value;
        const question = this.questions[this.currentStep - 1];

        if (question.type === 'multi') {
            // Multi-select logic
            let selected = this.answers[question.id] || [];

            if (selected.includes(value)) {
                selected = selected.filter(v => v !== value);
            } else if (selected.length < question.maxSelect) {
                selected.push(value);
            } else {
                GiftApp.showToast(`Maximum ${question.maxSelect} selections allowed`, 'info');
                return;
            }

            this.answers[question.id] = selected;
        } else {
            // Single select
            this.answers[question.id] = value;
        }

        this.saveState();
        this.render();

        // Auto-advance for single select (except last question)
        if (question.type !== 'multi' && this.currentStep < this.totalSteps) {
            setTimeout(() => this.next(), 300);
        }
    },

    next() {
        const question = this.questions[this.currentStep - 1];

        // Validate current step
        if (!this.validateStep()) {
            return;
        }

        if (this.currentStep === this.totalSteps) {
            // Complete quiz
            this.complete();
        } else {
            this.currentStep++;
            this.saveState();
            this.render();
        }
    },

    prev() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.saveState();
            this.render();
        }
    },

    validateStep() {
        const question = this.questions[this.currentStep - 1];

        switch (question.type) {
            case 'text':
                if (!this.answers[question.id] || this.answers[question.id].trim() === '') {
                    GiftApp.showToast('Please enter a name', 'error');
                    return false;
                }
                break;

            case 'birthday':
                // Birthday is optional - always valid
                // But if user entered partial data, require both fields
                const bday = this.answers.birthday;
                if (bday && (bday.month || bday.day)) {
                    if (!bday.month || !bday.day) {
                        GiftApp.showToast('Please select both month and day, or skip', 'error');
                        return false;
                    }
                }
                break;

            case 'single':
            case 'budget':
                if (!this.answers[question.id]) {
                    GiftApp.showToast('Please select an option', 'error');
                    return false;
                }
                break;

            case 'multi':
                if (!this.answers[question.id] || this.answers[question.id].length === 0) {
                    GiftApp.showToast('Please select at least one option', 'error');
                    return false;
                }
                break;
        }

        return true;
    },

    saveState() {
        GiftStorage.setCurrentQuiz({
            step: this.currentStep,
            answers: this.answers
        });
    },

    async complete() {
        // Format birthday as ISO date string for current year (for calendar use)
        let birthdayDate = null;
        if (this.answers.birthday && this.answers.birthday.month && this.answers.birthday.day) {
            const year = new Date().getFullYear();
            birthdayDate = `${year}-${this.answers.birthday.month}-${this.answers.birthday.day}`;
        }

        // Calculate psychology profile
        const oceanScores = this.calculateOCEAN();
        const mbtiType = this.inferMBTI(oceanScores);
        const confidence = this.calculateConfidence();

        const psychology = {
            ...oceanScores,
            mbti_type: mbtiType,
            confidence_score: confidence,
            quiz_answers: this.answers
        };

        // Create persona from answers
        const persona = {
            name: this.answers.name,
            birthday: birthdayDate,
            relationship: this.answers.relationship,
            interests: [...(this.answers.activities || []), ...(this.answers.giftTypes || [])],
            style: this.answers.style,
            budget: this.answers.budget,
            psychology: psychology
        };

        // Save persona (will use Supabase if available)
        const savedPersona = await GiftStorage.addPersona(persona);

        // Clear quiz state
        GiftStorage.clearCurrentQuiz();

        // Store persona ID for discovery flow
        GiftStorage.setCurrentDiscovery({
            personaId: savedPersona.id,
            step: 'occasion'
        });

        // Add birthday to calendar if provided
        if (birthdayDate) {
            await GiftStorage.addCalendarEvent({
                title: `${persona.name}'s Birthday`,
                date: birthdayDate,
                type: 'birthday',
                personaId: savedPersona.id,
                icon: '🎂'
            });
        }

        // Celebrate and redirect
        const quizCard = document.getElementById('quizCard');
        quizCard.classList.add('quiz-celebrate');

        GiftApp.showToast(`${persona.name}'s profile created!`, 'success');

        setTimeout(() => {
            window.location.href = 'discovery/occasion.html';
        }, 1000);
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    QuizWizard.init();
});

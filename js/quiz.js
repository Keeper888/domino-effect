/**
 * Gift Giver - Quiz Wizard Logic
 * 7-question persona creation wizard
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
                { value: 'gaming', icon: '🎮', label: 'Gaming' },
                { value: 'music', icon: '🎵', label: 'Music' },
                { value: 'cooking', icon: '👨‍🍳', label: 'Cooking' },
                { value: 'travel', icon: '✈️', label: 'Travel' },
                { value: 'tech', icon: '💻', label: 'Tech' },
                { value: 'fitness', icon: '🧘', label: 'Yoga/Gym' },
                { value: 'pets', icon: '🐕', label: 'With Pets' },
                { value: 'shopping', icon: '🛍️', label: 'Shopping' }
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
                { value: 'books', icon: '📚', label: 'Books/Journals' },
                { value: 'selfcare', icon: '🧴', label: 'Self-care' },
                { value: 'gadgets', icon: '🔌', label: 'Cool Gadgets' },
                { value: 'jewelry', icon: '💎', label: 'Jewelry' },
                { value: 'experiences', icon: '🎟️', label: 'Experiences' },
                { value: 'treats', icon: '🍫', label: 'Treats & Sweets' }
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
                { value: 'minimal', icon: '⬜', label: 'Minimal' },
                { value: 'cozy', icon: '🧸', label: 'Cozy' },
                { value: 'modern', icon: '🔲', label: 'Modern' },
                { value: 'vintage', icon: '📻', label: 'Vintage' },
                { value: 'boho', icon: '🌻', label: 'Boho' },
                { value: 'kawaii', icon: '🌸', label: 'Kawaii' },
                { value: 'elegant', icon: '✨', label: 'Elegant' },
                { value: 'rustic', icon: '🪵', label: 'Rustic' }
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

    complete() {
        // Format birthday as ISO date string for current year (for calendar use)
        let birthdayDate = null;
        if (this.answers.birthday && this.answers.birthday.month && this.answers.birthday.day) {
            const year = new Date().getFullYear();
            birthdayDate = `${year}-${this.answers.birthday.month}-${this.answers.birthday.day}`;
        }

        // Create persona from answers
        const persona = {
            name: this.answers.name,
            birthday: birthdayDate,
            relationship: this.answers.relationship,
            interests: [...(this.answers.activities || []), ...(this.answers.giftTypes || [])],
            style: this.answers.style,
            budget: this.answers.budget
        };

        // Save persona
        const savedPersona = GiftStorage.addPersona(persona);

        // Clear quiz state
        GiftStorage.clearCurrentQuiz();

        // Store persona ID for discovery flow
        GiftStorage.setCurrentDiscovery({
            personaId: savedPersona.id,
            step: 'occasion'
        });

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

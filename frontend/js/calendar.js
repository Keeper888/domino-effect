/**
 * Gift Giver - Calendar Logic
 * Handles calendar display and event management
 */

let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();
let selectedEventType = 'birthday';

document.addEventListener('DOMContentLoaded', () => {
    renderCalendar();
    renderEventsList();
    initEventForm();
    populatePersonaSelect();
});

// ==================== MINI CALENDAR ====================
function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const title = document.getElementById('calendarTitle');

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    title.textContent = `${monthNames[currentMonth]} ${currentYear}`;

    // Get events for highlighting
    const events = getAllEvents();
    const eventDates = {};
    events.forEach(e => {
        const date = new Date(e.date);
        const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        eventDates[key] = e.type;
    });

    // Day headers
    const dayHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    let html = dayHeaders.map(d => `<div class="mini-calendar-day-header">${d}</div>`).join('');

    // Get first day and days in month
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        html += `<div class="mini-calendar-day other-month">${day}</div>`;
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${currentYear}-${currentMonth}-${day}`;
        const isToday = dateKey === todayKey;
        const eventType = eventDates[dateKey];

        let classes = 'mini-calendar-day';
        if (isToday) classes += ' today';
        if (eventType === 'birthday') classes += ' has-event has-birthday';
        if (eventType === 'holiday') classes += ' has-event has-holiday';

        html += `<div class="${classes}">${day}</div>`;
    }

    // Next month days
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    const remainingCells = totalCells - (firstDay + daysInMonth);
    for (let day = 1; day <= remainingCells; day++) {
        html += `<div class="mini-calendar-day other-month">${day}</div>`;
    }

    grid.innerHTML = html;
}

function prevMonth() {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    renderCalendar();
}

function nextMonth() {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderCalendar();
}

// ==================== EVENTS LIST ====================
function getAllEvents() {
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

    return events;
}

function renderEventsList() {
    const list = document.getElementById('eventsList');
    const events = getAllEvents();

    // Filter and sort future events
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = events
        .filter(event => {
            const eventDate = new Date(event.date);
            eventDate.setHours(0, 0, 0, 0);
            return eventDate >= today;
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (upcoming.length === 0) {
        list.innerHTML = `
            <div class="empty-state" style="padding: 40px;">
                <div class="empty-icon">📅</div>
                <h3 class="empty-title">No upcoming events</h3>
                <p class="empty-text">Add birthdays and special occasions to never miss a gift!</p>
            </div>
        `;
        return;
    }

    list.innerHTML = upcoming.map(event => {
        const date = new Date(event.date);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const daysUntil = GiftApp.getDaysUntil(event.date);
        const isSoon = daysUntil === 'Today' || daysUntil === 'Tomorrow' ||
            (daysUntil.includes('days') && parseInt(daysUntil) <= 7);

        const canDelete = !event.id.startsWith('h') && !event.id.startsWith('b_');

        return `
            <div class="event-card">
                <div class="event-date-box ${event.type}">
                    <span class="event-date-month">${monthNames[date.getMonth()]}</span>
                    <span class="event-date-day">${date.getDate()}</span>
                </div>
                <span class="event-icon">${event.icon || '🎁'}</span>
                <div class="event-details">
                    <div class="event-name">${event.title}</div>
                    <div class="event-countdown ${isSoon ? 'soon' : ''}">${daysUntil}</div>
                </div>
                <div class="event-actions">
                    <button class="event-shop-btn" onclick="shopForEvent('${event.personaId || ''}')">
                        Shop Now
                    </button>
                    ${canDelete ? `
                        <button class="event-delete-btn" onclick="deleteEvent('${event.id}')" title="Delete">
                            ✕
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function shopForEvent(personaId) {
    if (personaId) {
        // Persona linked, go directly to occasion
        GiftStorage.setCurrentDiscovery({
            personaId: personaId,
            step: 'occasion'
        });
        window.location.href = 'discovery/occasion.html';
    } else {
        // No persona linked, go to persona selection
        window.location.href = 'discovery/select-persona.html';
    }
}

function deleteEvent(eventId) {
    if (confirm('Delete this event?')) {
        GiftStorage.deleteCalendarEvent(eventId);
        renderEventsList();
        renderCalendar();
        GiftApp.showToast('Event deleted', 'success');
    }
}

// ==================== ADD EVENT MODAL ====================
function openAddEventModal() {
    document.getElementById('addEventModal').classList.add('active');
    document.getElementById('eventName').focus();
}

function closeAddEventModal() {
    document.getElementById('addEventModal').classList.remove('active');
    document.getElementById('addEventForm').reset();
    // Reset type selection
    document.querySelectorAll('.event-type-btn').forEach(b => b.classList.remove('selected'));
    document.querySelector('[data-type="birthday"]').classList.add('selected');
    selectedEventType = 'birthday';
}

function initEventForm() {
    // Type selector
    document.querySelectorAll('.event-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.event-type-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedEventType = btn.dataset.type;
        });
    });

    // Form submission
    document.getElementById('addEventForm').addEventListener('submit', (e) => {
        e.preventDefault();

        const name = document.getElementById('eventName').value.trim();
        const date = document.getElementById('eventDate').value;
        const personaId = document.getElementById('eventPersona').value;

        if (!name || !date) {
            GiftApp.showToast('Please fill in all required fields', 'error');
            return;
        }

        const event = {
            title: name,
            date: date,
            type: selectedEventType,
            icon: selectedEventType === 'birthday' ? '🎂' : '🎁',
            personaId: personaId || null
        };

        GiftStorage.addCalendarEvent(event);

        closeAddEventModal();
        renderEventsList();
        renderCalendar();
        GiftApp.showToast('Event added!', 'success');
    });

    // Close on overlay click
    document.getElementById('addEventModal').addEventListener('click', (e) => {
        if (e.target.id === 'addEventModal') {
            closeAddEventModal();
        }
    });
}

function populatePersonaSelect() {
    const select = document.getElementById('eventPersona');
    const personas = GiftStorage.getPersonas();

    personas.forEach(persona => {
        const option = document.createElement('option');
        option.value = persona.id;
        option.textContent = persona.name;
        select.appendChild(option);
    });
}

// Make functions globally available
window.prevMonth = prevMonth;
window.nextMonth = nextMonth;
window.openAddEventModal = openAddEventModal;
window.closeAddEventModal = closeAddEventModal;
window.shopForEvent = shopForEvent;
window.deleteEvent = deleteEvent;

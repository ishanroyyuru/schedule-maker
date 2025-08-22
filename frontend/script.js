document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const profileBtn = document.getElementById('profile-btn');
    const findTimesBtn = document.getElementById('find-times-btn');
    const backBtn = document.getElementById('back-btn');
    const userInfoDiv = document.getElementById('user-info');
    const userNameSpan = document.getElementById('user-name');
    const calendarEventsDiv = document.getElementById('calendar-events');
    const homePage = document.getElementById('home-page');
    const profilePage = document.getElementById('profile-page');

    // Navigation buttons
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    const refreshBtn = document.getElementById('refresh-btn');

    // Find Times Modal Elements
    const findTimesModal = document.getElementById('find-times-modal');
    const closeFindTimesModalBtn = document.getElementById('close-find-times-modal');
    const cancelFindTimes = document.getElementById('cancel-find-times');
    const findTimesForm = document.getElementById('find-times-form');
    const friendCheckboxes = document.getElementById('friend-checkboxes');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const eventDurationInput = document.getElementById('event-duration');
    const startTimeInput = document.getElementById('start-time');
    const endTimeInput = document.getElementById('end-time');
    const findTimesResults = document.getElementById('find-times-results');
    const timeSlotsList = document.getElementById('time-slots-list');
    const findTimesLoading = document.getElementById('find-times-loading');
    const findTimesError = document.getElementById('find-times-error');

    console.log('Elements found:', {
        loginBtn: !!loginBtn,
        logoutBtn: !!logoutBtn,
        profileBtn: !!profileBtn,
        findTimesBtn: !!findTimesBtn,
        backBtn: !!backBtn,
        userInfoDiv: !!userInfoDiv,
        userNameSpan: !!userNameSpan,
        calendarEventsDiv: !!calendarEventsDiv,
        homePage: !!homePage,
        profilePage: !!profilePage,
        findTimesModal: !!findTimesModal,
        prevWeekBtn: !!prevWeekBtn,
        nextWeekBtn: !!nextWeekBtn,
        refreshBtn: !!refreshBtn
    });

    // Additional debugging
    console.log('Login button element:', loginBtn);
    console.log('Login button text:', loginBtn?.textContent);
    console.log('Login button display:', loginBtn?.style.display);

    const API_BASE_URL = 'http://localhost:3001/api';
    
    // Get token from URL if present (from OAuth redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
        localStorage.setItem('jwt_token', token);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const checkAuthStatus = async () => {
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            
            const response = await fetch(`${API_BASE_URL}/auth/status`, { headers });
            const data = await response.json();

            if (data.authenticated) {
                if (loginBtn) loginBtn.style.display = 'none';
                if (logoutBtn) logoutBtn.style.display = 'block';
                if (profileBtn) profileBtn.style.display = 'block';
                if (findTimesBtn) findTimesBtn.style.display = 'block';
                if (userInfoDiv) userInfoDiv.style.display = 'block';
                
                // If user data is available, use it; otherwise show generic message
                if (data.user && data.user.name && userNameSpan) {
                    userNameSpan.textContent = data.user.name;
                } else if (userNameSpan) {
                    userNameSpan.textContent = 'User';
                }
                
                await fetchCalendarEvents();
                await fetchCalendarConnections();
                await fetchFriendsForSidebar(); // Add this line
            } else {
                if (loginBtn) loginBtn.style.display = 'block';
                if (logoutBtn) logoutBtn.style.display = 'none';
                if (profileBtn) profileBtn.style.display = 'none';
                if (findTimesBtn) findTimesBtn.style.display = 'none';
                if (userInfoDiv) userInfoDiv.style.display = 'none';
                if (calendarEventsDiv) calendarEventsDiv.innerHTML = '<p>Please log in to see your calendar events.</p>';
            }
        } catch (error) {
            console.error('Failed to check authentication status:', error);
            if (loginBtn) loginBtn.style.display = 'block';
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (profileBtn) profileBtn.style.display = 'none';
            if (findTimesBtn) findTimesBtn.style.display = 'none';
            if (userInfoDiv) userInfoDiv.style.display = 'none';
            if (calendarEventsDiv) calendarEventsDiv.innerHTML = '<p>Failed to check authentication status.</p>';
        }
    };

    const handleLogin = async () => {
        console.log('Login button clicked');
        try {
            console.log('Fetching auth URL...');
            const response = await fetch(`${API_BASE_URL}/auth/google`);
            const { authUrl } = await response.json();
            console.log('Redirecting to:', authUrl);
            window.location.href = authUrl;
        } catch (error) {
            console.error('Login failed:', error);
            calendarEventsDiv.innerHTML = '<p>Login failed. Please try again.</p>';
        }
    };

    const handleLogout = async () => {
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            
            await fetch(`${API_BASE_URL}/auth/logout`, { 
                method: 'POST',
                headers 
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.removeItem('jwt_token');
            loginBtn.style.display = 'block';
            logoutBtn.style.display = 'none';
            profileBtn.style.display = 'none';
            userInfoDiv.style.display = 'none';
            calendarEventsDiv.innerHTML = '<p>Please log in to see your calendar events.</p>';
        }
    };

    const showProfile = async () => {
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            
            const response = await fetch(`${API_BASE_URL}/auth/me`, { headers });
            const data = await response.json();

            if (data.user) {
                document.getElementById('profile-name').textContent = data.user.name || 'N/A';
                document.getElementById('profile-email').textContent = data.user.email || 'N/A';
                document.getElementById('profile-timezone').textContent = data.user.timezone || 'UTC';
                
                const calendarConnection = data.calendarConnections?.[0];
                document.getElementById('profile-calendar').textContent = 
                    calendarConnection ? 'Google Calendar (Connected)' : 'No calendar connected';
            }

            // Load friends and pending requests
            await loadFriends();
            await loadPendingRequests();

            // Show profile page
            homePage.style.display = 'none';
            profilePage.style.display = 'flex';

        } catch (error) {
            console.error('Failed to fetch profile data:', error);
            showErrorMessage('Failed to load profile data');
        }
    };

    const showHome = () => {
        profilePage.style.display = 'none';
        homePage.style.display = 'flex';
    };

    // Find Times Functions (declared before event listeners)
    const openFindTimesModal = () => {
        // Set default dates (today to +14 days)
        const today = new Date();
        const endDate = new Date();
        endDate.setDate(today.getDate() + 14);
        
        if (startDateInput) startDateInput.value = today.toISOString().split('T')[0];
        if (endDateInput) endDateInput.value = endDate.toISOString().split('T')[0];
        
        // Populate friend checkboxes
        populateFriendCheckboxes();
        
        // Reset form and results
        if (findTimesForm) findTimesForm.reset();
        if (findTimesResults) findTimesResults.style.display = 'none';
        if (findTimesLoading) findTimesLoading.style.display = 'none';
        if (findTimesError) findTimesError.style.display = 'none';
        
        // Show modal
        if (findTimesModal) findTimesModal.style.display = 'flex';
    };

    const closeFindTimesModal = () => {
        if (findTimesModal) findTimesModal.style.display = 'none';
    };

    const populateFriendCheckboxes = async () => {
        if (!friendCheckboxes) return;
        
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            
            const response = await fetch(`${API_BASE_URL}/friends`, { headers });
            const data = await response.json();

            if (data.friends && data.friends.length > 0) {
                friendCheckboxes.innerHTML = data.friends.map(friend => `
                    <div class="friend-checkbox-item">
                        <input type="checkbox" id="friend-${friend.id}" name="friendIds" value="${friend.id}">
                        <label for="friend-${friend.id}">${friend.name}</label>
                    </div>
                `).join('');
            } else {
                friendCheckboxes.innerHTML = '<p>No friends found. Add some friends first!</p>';
            }
        } catch (error) {
            console.error('Failed to fetch friends:', error);
            if (friendCheckboxes) friendCheckboxes.innerHTML = '<p>Failed to load friends</p>';
        }
    };

    const handleFindTimesSubmit = async (e) => {
        e.preventDefault();
        
        // Get selected friends
        const selectedFriends = Array.from(document.querySelectorAll('input[name="friendIds"]:checked'))
            .map(checkbox => checkbox.value);
        
        if (selectedFriends.length === 0) {
            showFindTimesError('Please select at least one friend');
            return;
        }

        // Debug: Log the selected friends
        console.log('Selected friends:', selectedFriends);
        console.log('Selected friends type:', typeof selectedFriends[0]);

        // Get form data
        const formData = {
            friendIds: selectedFriends,
            startDate: startDateInput ? startDateInput.value : '',
            endDate: endDateInput ? endDateInput.value : '',
            duration: eventDurationInput ? parseInt(eventDurationInput.value) : 60,
            startTime: startTimeInput ? startTimeInput.value : '08:00',
            endTime: endTimeInput ? endTimeInput.value : '20:00'
        };

        // Debug: Log the form data being sent
        console.log('Form data being sent:', formData);
        console.log('Start date object:', new Date(formData.startDate));
        console.log('End date object:', new Date(formData.endDate));

        // Validate time window
        if (formData.startTime >= formData.endTime) {
            showFindTimesError('Start time must be before end time');
            return;
        }

        // Show loading state
        if (findTimesLoading) findTimesLoading.style.display = 'flex';
        if (findTimesResults) findTimesResults.style.display = 'none';
        if (findTimesError) findTimesError.style.display = 'none';

        try {
            const token = localStorage.getItem('jwt_token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            
            const response = await fetch(`${API_BASE_URL}/friends/find-times`, {
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                displayFindTimesResults(data.freeTimes);
            } else {
                showFindTimesError(data.error || 'Failed to find common times');
            }
        } catch (error) {
            console.error('Find times error:', error);
            showFindTimesError('Failed to find common times. Please try again.');
        } finally {
            if (findTimesLoading) findTimesLoading.style.display = 'none';
        }
    };

    const displayFindTimesResults = (freeTimes) => {
        if (!timeSlotsList) return;
        
        if (freeTimes.length === 0) {
            timeSlotsList.innerHTML = '<p>No common free times found in the specified range.</p>';
        } else {
            timeSlotsList.innerHTML = freeTimes.map(slot => {
                const startDate = new Date(slot.start);
                const endDate = new Date(slot.end);
                
                return `
                    <div class="time-slot-item">
                        <div class="time-slot-info">
                            <div class="time-slot-date">${startDate.toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                month: 'short', 
                                day: 'numeric' 
                            })}</div>
                            <div class="time-slot-time">${startDate.toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true 
                            })} - ${endDate.toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true 
                            })}</div>
                        </div>
                        <button class="create-event-btn" onclick="createEventFromSlot('${slot.start}', '${slot.end}')">
                            Create Event
                        </button>
                    </div>
                `;
            }).join('');
        }
        
        if (findTimesResults) findTimesResults.style.display = 'block';
    };

    const showFindTimesError = (message) => {
        if (!findTimesError) return;
        const errorMessage = findTimesError.querySelector('.error-message');
        if (errorMessage) errorMessage.textContent = message;
        findTimesError.style.display = 'block';
    };

    // Global function for create event button (needs to be accessible from onclick)
    window.createEventFromSlot = (startTime, endTime) => {
        // For now, just show an alert - you can integrate with your existing event creation flow
        alert(`Creating event from ${new Date(startTime).toLocaleString()} to ${new Date(endTime).toLocaleString()}`);
        closeFindTimesModal();
        // TODO: Integrate with existing event creation modal/form
    };

    // Event listeners for navigation
    if (profileBtn) profileBtn.addEventListener('click', showProfile);
    if (backBtn) backBtn.addEventListener('click', showHome);

    // Find Times Event Listeners
    if (findTimesBtn) findTimesBtn.addEventListener('click', openFindTimesModal);
    if (closeFindTimesModalBtn) closeFindTimesModalBtn.addEventListener('click', closeFindTimesModal);
    if (cancelFindTimes) cancelFindTimes.addEventListener('click', closeFindTimesModal);
    if (findTimesForm) findTimesForm.addEventListener('submit', handleFindTimesSubmit);

    // Close modal on backdrop click
    if (findTimesModal) {
        findTimesModal.addEventListener('click', (e) => {
            if (e.target === findTimesModal) {
                closeFindTimesModal();
            }
        });
    }

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && findTimesModal && findTimesModal.style.display !== 'none') {
            closeFindTimesModal();
        }
    });

    // Event listeners
    checkAuthStatus();
    if (loginBtn) {
        console.log('Adding click listener to login button');
        loginBtn.addEventListener('click', handleLogin);
    } else {
        console.error('Login button not found!');
    }
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    console.log('Event listeners attached');

    const fetchCalendarConnections = async () => {
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            
            const response = await fetch(`${API_BASE_URL}/calendars/connections`, { headers });
            const data = await response.json();

            if (!data.success) {
                console.error('Failed to fetch calendar connections:', data.error);
                return;
            }

            console.log('Calendar connections:', data.connections);
        } catch (error) {
            console.error('Failed to fetch calendar connections:', error);
        }
    };

    let currentWeekStart = null;

    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric'
        });
    };

    const isToday = (date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    };

    const createDayElement = (date, events) => {
        const dayEvents = events.filter(event => {
            const eventDate = new Date(event.startTime);
            return eventDate.getDate() === date.getDate() &&
                   eventDate.getMonth() === date.getMonth() &&
                   eventDate.getFullYear() === date.getFullYear();
        });

        const dayElement = document.createElement('div');
        dayElement.className = `calendar-day${isToday(date) ? ' today' : ''}`;

        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.innerHTML = `<span class="calendar-date">${formatDate(date)}</span>`;
        dayElement.appendChild(dayHeader);

        const eventsList = document.createElement('ul');
        eventsList.className = 'calendar-events-list';

        dayEvents.forEach(event => {
            const eventItem = document.createElement('li');
            eventItem.className = 'calendar-event';
            eventItem.style.borderLeftColor = event.calendarColor || '#4285f4';
            eventItem.innerHTML = `
                <div class="calendar-event-time">${formatTime(new Date(event.startTime))}</div>
                <div class="calendar-event-title">${event.title}</div>
            `;
            
            // Add tooltip with more details
            const tooltip = document.createElement('div');
            tooltip.className = 'event-tooltip';
            tooltip.innerHTML = `
                <strong>${event.title}</strong><br>
                Time: ${formatTime(new Date(event.startTime))} - ${formatTime(new Date(event.endTime))}<br>
                ${event.location ? `Location: ${event.location}<br>` : ''}
                Calendar: ${event.calendarName}
            `;
            eventItem.appendChild(tooltip);
            
            eventsList.appendChild(eventItem);
        });

        dayElement.appendChild(eventsList);
        return dayElement;
    };

    // Add tooltip styles
    const style = document.createElement('style');
    style.textContent = `
        .calendar-event {
            position: relative;
        }
        
        .event-tooltip {
            display: none;
            position: absolute;
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            z-index: 1000;
            min-width: 200px;
            left: 100%;
            top: 0;
            margin-left: 10px;
        }
        
        .calendar-event:hover .event-tooltip {
            display: block;
        }
    `;
    document.head.appendChild(style);

    const updateCalendarGrid = async (weekStart) => {
        const calendarBody = document.querySelector('.calendar-body');
        if (!calendarBody) return;

        // Update current week display
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        document.querySelector('.current-week').textContent = 
            `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;

        // Fetch events for the week
        const events = await fetchCalendarEvents('week', true, false, weekStart, weekEnd);
        if (!events) return;

        // Clear existing calendar days
        calendarBody.innerHTML = '';

        // Create day elements for the week
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + i);
            const dayElement = createDayElement(date, events);
            calendarBody.appendChild(dayElement);
        }
    };

    const navigateWeek = (direction) => {
        if (!currentWeekStart) {
            currentWeekStart = new Date();
            const day = currentWeekStart.getDay();
            const diff = currentWeekStart.getDate() - day + (day === 0 ? -6 : 1);
            currentWeekStart.setDate(diff);
        }

        const newWeekStart = new Date(currentWeekStart);
        newWeekStart.setDate(newWeekStart.getDate() + (direction === 'next' ? 7 : -7));
        currentWeekStart = newWeekStart;
        updateCalendarGrid(currentWeekStart);
    };

    // Add event listeners for week navigation
    document.getElementById('prev-week')?.addEventListener('click', () => navigateWeek('prev'));
    document.getElementById('next-week')?.addEventListener('click', () => navigateWeek('next'));

    // Modify the existing fetchCalendarEvents function
    const fetchCalendarEvents = async (period = 'week', useCache = true, forceSync = false, customStartDate = null, customEndDate = null) => {
        try {
            const token = localStorage.getItem('jwt_token');
            if (!token) {
                calendarEventsDiv.innerHTML = '<p>Please log in to see your calendar events.</p>';
                return null;
            }

            const headers = { 'Authorization': `Bearer ${token}` };
            let url = `${API_BASE_URL}/calendars/events?useCache=${useCache}&forceSync=${forceSync}`;

            if (customStartDate && customEndDate) {
                url += `&startDate=${customStartDate.toISOString()}&endDate=${customEndDate.toISOString()}`;
            }

            const response = await fetch(url, { headers });
            const data = await response.json();

            if (!data.success) {
                if (data.error === 'RATE_LIMIT_EXCEEDED') {
                    showRateLimitMessage(data.retryAfter);
                } else {
                    showErrorMessage(data.error);
                }
                return null;
            }

            // Initialize the calendar if this is the first load
            if (!currentWeekStart) {
                currentWeekStart = new Date();
                const day = currentWeekStart.getDay();
                const diff = currentWeekStart.getDate() - day + (day === 0 ? -6 : 1);
                currentWeekStart.setDate(diff);
                currentWeekStart.setHours(0, 0, 0, 0);
                updateCalendarGrid(currentWeekStart);
            }

            return data.events;

        } catch (error) {
            console.error('Failed to fetch calendar events:', error);
            showErrorMessage('Failed to fetch calendar events');
            return null;
        }
    };

    const refreshCalendar = async () => {
        try {
            if (!refreshBtn) return;
            
            // Add loading state
            refreshBtn.classList.add('loading');
            refreshBtn.disabled = true;
            
            // Force sync with no cache
            await fetchCalendarEvents('week', false, true, currentWeekStart, new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000));
            
            // Update the calendar grid with fresh data
            await updateCalendarGrid(currentWeekStart);
            
            showSuccessMessage('Calendar refreshed successfully!');
        } catch (error) {
            console.error('Failed to refresh calendar:', error);
            showErrorMessage('Failed to refresh calendar');
        } finally {
            if (refreshBtn) {
                refreshBtn.classList.remove('loading');
                refreshBtn.disabled = false;
            }
        }
    };

    const showRateLimitMessage = (retryAfter) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'rate-limit-message';
        messageDiv.innerHTML = `
            <div class="alert alert-warning">
                <strong>Too many refresh requests!</strong> 
                Please wait ${retryAfter} seconds before trying again.
            </div>
        `;
        
        // Insert at the top of calendar events
        calendarEventsDiv.insertBefore(messageDiv, calendarEventsDiv.firstChild);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 5000);
    };

    const showSuccessMessage = (message) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'success-message';
        messageDiv.innerHTML = `
            <div class="alert alert-success">
                <strong>Success!</strong> ${message}
            </div>
        `;
        
        // Insert at the top of calendar events
        calendarEventsDiv.insertBefore(messageDiv, calendarEventsDiv.firstChild);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 3000);
    };

    const showErrorMessage = (message) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'error-message';
        messageDiv.innerHTML = `
            <div class="alert alert-danger">
                <strong>Error!</strong> ${message}
            </div>
        `;
        
        // Insert at the top of calendar events
        calendarEventsDiv.insertBefore(messageDiv, calendarEventsDiv.firstChild);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 5000);
    };

    const createTimePeriodSelector = (currentPeriod = 'today') => {
        const selectorDiv = document.createElement('div');
        selectorDiv.className = 'time-period-selector';
        selectorDiv.innerHTML = `
            <div class="period-buttons">
                <button class="period-btn ${currentPeriod === 'today' ? 'active' : ''}" data-period="today">Today</button>
                <button class="period-btn ${currentPeriod === 'week' ? 'active' : ''}" data-period="week">This Week</button>
                <button class="period-btn ${currentPeriod === 'month' ? 'active' : ''}" data-period="month">This Month</button>
                <button class="period-btn ${currentPeriod === 'custom' ? 'active' : ''}" data-period="custom">Custom Range</button>
            </div>
            <div class="custom-date-range" style="display: ${currentPeriod === 'custom' ? 'block' : 'none'};">
                <div class="date-inputs">
                    <div class="date-input">
                        <label for="start-date">Start Date:</label>
                        <input type="date" id="start-date">
                    </div>
                    <div class="date-input">
                        <label for="end-date">End Date:</label>
                        <input type="date" id="end-date">
                    </div>
                    <button class="apply-custom-btn">Apply</button>
                </div>
            </div>
        `;

        // Add event listeners for period buttons
        const periodButtons = selectorDiv.querySelectorAll('.period-btn');
        periodButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                // Remove active class from all buttons
                periodButtons.forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                btn.classList.add('active');
                
                const period = btn.dataset.period;
                const customRange = selectorDiv.querySelector('.custom-date-range');
                
                if (period === 'custom') {
                    customRange.style.display = 'block';
                    // Set default dates (current week)
                    const { startDate, endDate } = getDateRange('week');
                    document.getElementById('start-date').value = startDate.toISOString().split('T')[0];
                    document.getElementById('end-date').value = endDate.toISOString().split('T')[0];
                } else {
                    customRange.style.display = 'none';
                    await fetchCalendarEvents(period);
                }
            });
        });

        // Add event listener for apply custom button
        const applyBtn = selectorDiv.querySelector('.apply-custom-btn');
        applyBtn.addEventListener('click', async () => {
            const startDate = document.getElementById('start-date').value;
            const endDate = document.getElementById('end-date').value;
            
            if (!startDate || !endDate) {
                showErrorMessage('Please select both start and end dates');
                return;
            }
            
            if (new Date(startDate) > new Date(endDate)) {
                showErrorMessage('Start date must be before end date');
                return;
            }
            
            await fetchCalendarEvents('custom', true, false, startDate, endDate);
        });

        return selectorDiv;
    };

    const displayNoEvents = (period = 'today', startDate, endDate) => {
        const dateRange = formatDateRange(startDate, endDate);
        const periodText = period === 'today' ? 'Today' : 
                          period === 'week' ? 'This Week' : 
                          period === 'month' ? 'This Month' : 'Custom Range';

        const timeSelector = createTimePeriodSelector(period);
        
        calendarEventsDiv.innerHTML = '';
        calendarEventsDiv.appendChild(timeSelector);
        
        const noEventsDiv = document.createElement('div');
        noEventsDiv.className = 'no-events';
        noEventsDiv.innerHTML = `
            <h3>📅 No Events ${periodText} (${dateRange})</h3>
            <p>You don't have any events scheduled for this period.</p>
            <div class="sync-controls">
                <button id="refresh-btn" class="sync-btn">🔄 Refresh Calendar</button>
            </div>
        `;
        calendarEventsDiv.appendChild(noEventsDiv);

        // Add event listener for the refresh button
        document.getElementById('refresh-btn').addEventListener('click', async () => {
            console.log('Refresh button clicked');
            const success = await refreshCalendar();
            if (success) {
                await fetchCalendarEvents(period, true, false);
            }
        });
    };

    const displayCalendarEvents = (events, period = 'today', startDate, endDate) => {
        if (!events || events.length === 0) {
            displayNoEvents(period, startDate, endDate);
            return;
        }

        const dateRange = formatDateRange(startDate, endDate);
        const periodText = period === 'today' ? 'Today' : 
                          period === 'week' ? 'This Week' : 
                          period === 'month' ? 'This Month' : 'Custom Range';

        const timeSelector = createTimePeriodSelector(period);
        
        calendarEventsDiv.innerHTML = '';
        calendarEventsDiv.appendChild(timeSelector);
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'calendar-header';
        headerDiv.innerHTML = `
            <h3>📅 ${periodText}'s Events (${dateRange})</h3>
            <div class="sync-controls">
                <button id="refresh-btn" class="sync-btn">🔄 Refresh</button>
            </div>
        `;
        calendarEventsDiv.appendChild(headerDiv);
        
        const eventsListDiv = document.createElement('div');
        eventsListDiv.className = 'events-list';

        events.forEach(event => {
            const eventDate = new Date(event.startTime);
            const timeString = event.isAllDay 
                ? 'All day'
                : eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            const dateString = eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            
            const calendarName = event.calendarName || event.calendarId || 'Unknown Calendar';
            const calendarColor = event.calendarColor || '#4285f4';
            
            const eventCard = document.createElement('div');
            eventCard.className = 'event-card';
            eventCard.innerHTML = `
                <div class="event-header">
                    <h3>${event.title || 'Untitled Event'}</h3>
                    <span class="calendar-badge" style="background-color: ${calendarColor}; color: white;">📅 ${calendarName}</span>
                </div>
                <div class="event-time">${dateString} at ${timeString}</div>
                ${event.description ? `<div class="event-description">${event.description}</div>` : ''}
                ${event.location ? `<div class="event-location">📍 ${event.location}</div>` : ''}
                ${event.attendees && event.attendees.length > 0 ? 
                    `<div class="event-attendees">👥 ${event.attendees.length} attendee${event.attendees.length > 1 ? 's' : ''}</div>` : ''}
            `;
            eventsListDiv.appendChild(eventCard);
        });

        calendarEventsDiv.appendChild(eventsListDiv);

        // Add event listener for the refresh button
        document.getElementById('refresh-btn').addEventListener('click', async () => {
            console.log('Refresh button clicked');
            const success = await refreshCalendar();
            if (success) {
                await fetchCalendarEvents(period, true, false);
            }
        });
    };

    // Friend management functions
    const loadFriends = async () => {
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            
            const response = await fetch(`${API_BASE_URL}/friends`, { headers });
            const data = await response.json();

            const friendsList = document.getElementById('friends-list');
            friendsList.innerHTML = '';

            if (data.friends && data.friends.length > 0) {
                data.friends.forEach(friend => {
                    friendsList.appendChild(createFriendElement(friend, 'friend'));
                });
            } else {
                friendsList.innerHTML = '<p class="empty-message">No friends added yet</p>';
            }
        } catch (error) {
            console.error('Failed to load friends:', error);
            showErrorMessage('Failed to load friends list');
        }
    };

    const loadPendingRequests = async () => {
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            
            const response = await fetch(`${API_BASE_URL}/friends/pending`, { headers });
            const data = await response.json();

            const pendingList = document.getElementById('pending-requests');
            pendingList.innerHTML = '';

            if (data.requests && data.requests.length > 0) {
                data.requests.forEach(request => {
                    pendingList.appendChild(createFriendElement(request, 'request'));
                });
            } else {
                pendingList.innerHTML = '<p class="empty-message">No pending friend requests</p>';
            }
        } catch (error) {
            console.error('Failed to load pending requests:', error);
            showErrorMessage('Failed to load friend requests');
        }
    };

    const createFriendElement = (user, type) => {
        const div = document.createElement('div');
        div.className = 'friend-item';
        
        const info = document.createElement('div');
        info.className = 'friend-info';
        
        const name = document.createElement('div');
        name.className = 'friend-name';
        name.textContent = user.name;
        
        const email = document.createElement('div');
        email.className = 'friend-email';
        email.textContent = user.email;
        
        info.appendChild(name);
        info.appendChild(email);
        
        const actions = document.createElement('div');
        actions.className = 'friend-actions';
        
        if (type === 'request') {
            const acceptBtn = document.createElement('button');
            acceptBtn.className = 'friend-btn accept';
            acceptBtn.textContent = 'Accept';
            acceptBtn.onclick = () => handleFriendRequest(user.id, 'accept');
            
            const rejectBtn = document.createElement('button');
            rejectBtn.className = 'friend-btn reject';
            rejectBtn.textContent = 'Reject';
            rejectBtn.onclick = () => handleFriendRequest(user.id, 'reject');
            
            actions.appendChild(acceptBtn);
            actions.appendChild(rejectBtn);
        } else if (type === 'friend') {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'friend-btn remove';
            removeBtn.textContent = 'Remove';
            removeBtn.onclick = () => removeFriend(user.id);
            
            actions.appendChild(removeBtn);
        } else if (type === 'search') {
            const addBtn = document.createElement('button');
            addBtn.className = 'friend-btn add';
            addBtn.textContent = 'Add Friend';
            addBtn.onclick = () => sendFriendRequest(user.id);
            
            actions.appendChild(addBtn);
        }
        
        div.appendChild(info);
        div.appendChild(actions);
        
        return div;
    };

    const handleFriendRequest = async (friendId, action) => {
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };
            
            const response = await fetch(`${API_BASE_URL}/friends/${action}/${friendId}`, {
                method: 'PUT',
                headers
            });
            
            if (!response.ok) throw new Error(`Failed to ${action} friend request`);
            
            // Reload friends and pending requests
            await loadFriends();
            await loadPendingRequests();
            
            showSuccessMessage(`Friend request ${action}ed successfully`);
        } catch (error) {
            console.error(`Failed to ${action} friend request:`, error);
            showErrorMessage(`Failed to ${action} friend request`);
        }
    };

    const removeFriend = async (friendId) => {
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = { 'Authorization': `Bearer ${token}` };
            
            const response = await fetch(`${API_BASE_URL}/friends/${friendId}`, {
                method: 'DELETE',
                headers
            });
            
            if (!response.ok) throw new Error('Failed to remove friend');
            
            await loadFriends();
            showSuccessMessage('Friend removed successfully');
        } catch (error) {
            console.error('Failed to remove friend:', error);
            showErrorMessage('Failed to remove friend');
        }
    };

    const sendFriendRequest = async (friendId) => {
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };
            
            const response = await fetch(`${API_BASE_URL}/friends/request/${friendId}`, {
                method: 'POST',
                headers
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to send friend request');
            }
            
            showSuccessMessage('Friend request sent successfully');
            document.getElementById('friend-search').value = '';
            document.getElementById('friend-search-results').innerHTML = '';
        } catch (error) {
            console.error('Failed to send friend request:', error);
            showErrorMessage(error.message);
        }
    };

    // Friend search functionality
    let searchTimeout;
    const friendSearch = document.getElementById('friend-search');
    const searchResults = document.getElementById('friend-search-results');

    friendSearch.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            searchResults.innerHTML = '';
            searchResults.classList.remove('active');
            return;
        }
        
        searchTimeout = setTimeout(async () => {
            try {
                const token = localStorage.getItem('jwt_token');
                const headers = { 'Authorization': `Bearer ${token}` };
                
                const response = await fetch(`${API_BASE_URL}/friends/search?query=${encodeURIComponent(query)}`, { headers });
                const data = await response.json();
                
                searchResults.innerHTML = '';
                
                if (data.users && data.users.length > 0) {
                    data.users.forEach(user => {
                        searchResults.appendChild(createFriendElement(user, 'search'));
                    });
                    searchResults.classList.add('active');
                } else {
                    searchResults.innerHTML = '<p class="empty-message">No users found</p>';
                    searchResults.classList.add('active');
                }
            } catch (error) {
                console.error('Failed to search users:', error);
                showErrorMessage('Failed to search users');
            }
        }, 300);
    });

    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.friend-search')) {
            searchResults.classList.remove('active');
        }
    });

    // Add refresh button event listener
    refreshBtn?.addEventListener('click', async () => {
        // Only refresh if we're viewing our own calendar
        if (currentFriendId === null) {
            await refreshCalendar();
        } else {
            // If viewing a friend's calendar, refresh their calendar instead
            await syncFriendCalendar(currentFriendId);
        }
    });

    // Friend Calendar Functionality
    let currentFriendId = null;
    let currentFriendName = '';

    const fetchFriendsForSidebar = async () => {
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = { 'Authorization': `Bearer ${token}` };
            
            const response = await fetch(`${API_BASE_URL}/friends`, { headers });
            const data = await response.json();
            
            const sidebarList = document.getElementById('friends-list-sidebar');
            
            if (data.friends && data.friends.length > 0) {
                sidebarList.innerHTML = '';
                data.friends.forEach(friend => {
                    sidebarList.appendChild(createFriendSidebarItem(friend));
                });
            } else {
                sidebarList.innerHTML = '<p class="empty-message">No friends added yet</p>';
            }
        } catch (error) {
            console.error('Failed to fetch friends for sidebar:', error);
        }
    };

    const createFriendSidebarItem = (friend) => {
        const friendItem = document.createElement('div');
        friendItem.className = 'friend-item-sidebar';
        friendItem.dataset.friendId = friend.id;
        
        const avatar = document.createElement('div');
        avatar.className = 'friend-avatar-sidebar';
        avatar.textContent = friend.name.charAt(0).toUpperCase();
        
        const name = document.createElement('div');
        name.className = 'friend-name-sidebar';
        name.textContent = friend.name;
        
        const syncBtn = document.createElement('button');
        syncBtn.className = 'friend-sync-btn-sidebar';
        syncBtn.textContent = '↻';
        syncBtn.title = 'Sync friend calendar';
        syncBtn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // Show loading state
            syncBtn.textContent = '⏳';
            syncBtn.disabled = true;
            
            try {
                await syncFriendCalendar(friend.id);
            } finally {
                // Restore button state
                syncBtn.textContent = '↻';
                syncBtn.disabled = false;
            }
        };
        
        friendItem.appendChild(avatar);
        friendItem.appendChild(name);
        friendItem.appendChild(syncBtn);
        
        friendItem.onclick = () => selectFriend(friend.id, friend.name);
        
        return friendItem;
    };

    const selectFriend = async (friendId, friendName) => {
        // Update active state
        document.querySelectorAll('.friend-item-sidebar').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-friend-id="${friendId}"]`).classList.add('active');
        
        currentFriendId = friendId;
        currentFriendName = friendName;
        
        // Update calendar title
        document.querySelector('.current-week').textContent = `${friendName}'s Week`;
        
        // Load friend's calendar
        await loadFriendCalendar(friendId);
    };

    const loadFriendCalendar = async (friendId) => {
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = { 'Authorization': `Bearer ${token}` };
            
            // Get current week's Monday date (same as what the user is viewing)
            const now = new Date();
            const dayOfWeek = now.getDay();
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const monday = new Date(now);
            monday.setDate(now.getDate() - daysToMonday);
            monday.setHours(0, 0, 0, 0);
            
            console.log(`Loading friend ${friendId} calendar for week starting:`, monday.toISOString());
            
            const response = await fetch(
                `${API_BASE_URL}/friends/${friendId}/calendar?period=week&date=${monday.toISOString()}`,
                { headers }
            );
            
            if (!response.ok) throw new Error('Failed to load friend calendar');
            
            const data = await response.json();
            console.log('Friend calendar response:', data);
            
            if (data.success) {
                // Transform events to match calendar format
                const transformedEvents = data.events.map(event => ({
                    ...event,
                    start: new Date(event.startTime),
                    end: new Date(event.endTime),
                    title: event.title,
                    calendarColor: event.calendarColor,
                    calendarName: event.calendarName,
                    location: event.location
                }));
                
                console.log('Transformed events:', transformedEvents);
                
                // Update calendar with friend's events
                updateCalendarWithEvents(transformedEvents);
            } else {
                console.error('Friend calendar load failed:', data);
            }
        } catch (error) {
            console.error('Failed to load friend calendar:', error);
            showErrorMessage('Failed to load friend calendar');
        }
    };

    const syncFriendCalendar = async (friendId) => {
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = { 'Authorization': `Bearer ${token}` };
            
            // First, sync the friend's calendar
            const response = await fetch(`${API_BASE_URL}/friends/${friendId}/sync`, {
                method: 'POST',
                headers
            });
            
            if (!response.ok) throw new Error('Failed to sync friend calendar');
            
            const data = await response.json();
            
            if (data.success) {
                showSuccessMessage('Friend calendar synced successfully');
                
                // Always reload the friend's calendar if they are currently selected
                if (currentFriendId === friendId) {
                    await loadFriendCalendar(friendId);
                }
            } else {
                showErrorMessage(data.message || 'Failed to sync friend calendar');
            }
        } catch (error) {
            console.error('Failed to sync friend calendar:', error);
            showErrorMessage('Failed to sync friend calendar');
        }
    };

    const updateCalendarWithEvents = (events) => {
        console.log('Updating calendar with events:', events);
        
        // Clear existing events
        document.querySelectorAll('.calendar-day').forEach(day => {
            // Keep the header but clear the events list
            const header = day.querySelector('.calendar-day-header');
            day.innerHTML = '';
            if (header) {
                day.appendChild(header);
            }
        });
        
        // Add events to calendar with proper formatting
        events.forEach(event => {
            const eventDate = new Date(event.start);
            const dayOfWeek = eventDate.getDay();
            const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday=0, Sunday=6
            
            console.log(`Event "${event.title}" on day ${dayOfWeek} (index ${dayIndex})`);
            
            const dayElement = document.querySelectorAll('.calendar-day')[dayIndex];
            if (dayElement) {
                // Create events list if it doesn't exist
                let eventsList = dayElement.querySelector('.calendar-events-list');
                if (!eventsList) {
                    eventsList = document.createElement('ul');
                    eventsList.className = 'calendar-events-list';
                    dayElement.appendChild(eventsList);
                }
                
                const eventItem = document.createElement('li');
                eventItem.className = 'calendar-event';
                eventItem.style.borderLeftColor = event.calendarColor || '#4285f4';
                eventItem.innerHTML = `
                    <div class="calendar-event-time">${formatTime(new Date(event.start))}</div>
                    <div class="calendar-event-title">${event.title}</div>
                `;
                
                // Add tooltip with more details
                const tooltip = document.createElement('div');
                tooltip.className = 'event-tooltip';
                tooltip.innerHTML = `
                    <strong>${event.title}</strong><br>
                    Time: ${formatTime(new Date(event.start))} - ${formatTime(new Date(event.end))}<br>
                    ${event.location ? `Location: ${event.location}<br>` : ''}
                    Calendar: ${event.calendarName || 'Friend Calendar'}
                `;
                eventItem.appendChild(tooltip);
                
                eventsList.appendChild(eventItem);
                console.log(`Added event "${event.title}" to day ${dayIndex}`);
            } else {
                console.error(`Day element not found for index ${dayIndex}`);
            }
        });
    };

    // Add function to show my calendar
    const showMyCalendar = () => {
        currentFriendId = null;
        currentFriendName = '';
        
        // Update calendar title
        document.querySelector('.current-week').textContent = 'Current Week';
        
        // Clear active friend selection
        document.querySelectorAll('.friend-item-sidebar').forEach(item => {
            item.classList.remove('active');
        });
        
        // Get current week start (Monday)
        const now = new Date();
        const dayOfWeek = now.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = new Date(now);
        monday.setDate(now.getDate() - daysToMonday);
        monday.setHours(0, 0, 0, 0);
        
        // Restore my calendar view
        updateCalendarGrid(monday);
    };

    // Add "My Calendar" button to sidebar
    const addMyCalendarButton = () => {
        const sidebar = document.getElementById('friends-sidebar');
        const myCalendarBtn = document.createElement('div');
        myCalendarBtn.className = 'friend-item-sidebar my-calendar-btn';
        myCalendarBtn.innerHTML = `
            <div class="friend-avatar-sidebar" style="background: #e74c3c;">M</div>
            <div class="friend-name-sidebar">My Calendar</div>
        `;
        myCalendarBtn.onclick = showMyCalendar;
        
        // Insert at the top
        const friendsList = document.getElementById('friends-list-sidebar');
        sidebar.insertBefore(myCalendarBtn, friendsList);
    };

    // Initialize my calendar button
    addMyCalendarButton();
}); 
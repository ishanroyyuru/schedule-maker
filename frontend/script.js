document.addEventListener('DOMContentLoaded', () => {
    // Sidebar: render friends
    // fetchAndRenderSidebarFriends(); // Removed - this function looks for non-existent 'sidebar' element

    console.log('DOM loaded, initializing app...');
    
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const profileBtn = document.getElementById('profile-btn');
    const backBtn = document.getElementById('back-btn');
    const userInfoDiv = document.getElementById('user-info');
    const userNameSpan = document.getElementById('user-name');
    const calendarEventsDiv = document.getElementById('calendar-events');
    const homePage = document.getElementById('home-page');
    const profilePage = document.getElementById('profile-page');

    console.log('Elements found:', {
        loginBtn: !!loginBtn,
        logoutBtn: !!logoutBtn,
        profileBtn: !!profileBtn,
        backBtn: !!backBtn,
        userInfoDiv: !!userInfoDiv,
        userNameSpan: !!userNameSpan,
        calendarEventsDiv: !!calendarEventsDiv,
        homePage: !!homePage,
        profilePage: !!profilePage
    });

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
                loginBtn.style.display = 'none';
                logoutBtn.style.display = 'block';
                profileBtn.style.display = 'block';
                userInfoDiv.style.display = 'block';
                
                // If user data is available, use it; otherwise show generic message
                if (data.user && data.user.name) {
                    userNameSpan.textContent = data.user.name;
                } else {
                    userNameSpan.textContent = 'User';
                }
                
                await fetchCalendarEvents();
                await fetchCalendarConnections();
            } else {
                loginBtn.style.display = 'block';
                logoutBtn.style.display = 'none';
                profileBtn.style.display = 'none';
                userInfoDiv.style.display = 'none';
                calendarEventsDiv.innerHTML = '<p>Please log in to see your calendar events.</p>';
            }
        } catch (error) {
            console.error('Failed to check authentication status:', error);
            loginBtn.style.display = 'block';
            logoutBtn.style.display = 'none';
            profileBtn.style.display = 'none';
            userInfoDiv.style.display = 'none';
            calendarEventsDiv.innerHTML = '<p>Failed to check authentication status.</p>';
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

    // Only add event listeners if elements exist
    if (profileBtn) profileBtn.addEventListener('click', showProfile);
    if (backBtn) backBtn.addEventListener('click', showHome);
    if (loginBtn) loginBtn.addEventListener('click', handleLogin);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    checkAuthStatus();

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

    const refreshBtn = document.getElementById('refresh-btn');
    
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
                    
                    // Check if we're currently viewing a friend's calendar
                    if (window.currentFriendId && window.currentFriendName) {
                        // Fetch friend's calendar for the selected period
                        await fetchFriendCalendarForPeriod(window.currentFriendId, window.currentFriendName, period);
                    } else {
                        // Fetch current user's calendar
                        await fetchCalendarEvents(period);
                    }
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
            
            // Check if we're currently viewing a friend's calendar
            if (window.currentFriendId && window.currentFriendName) {
                // Fetch friend's calendar for the custom date range
                await fetchFriendCalendarForCustomRange(window.currentFriendId, window.currentFriendName, startDate, endDate);
            } else {
                // Fetch current user's calendar
                await fetchCalendarEvents('custom', true, false, startDate, endDate);
            }
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
        
        // Add back button if viewing friend's calendar
        if (window.currentFriendId && window.currentFriendName) {
            addBackToMyScheduleButton();
        }
        
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
            
            // Check if we're currently viewing a friend's calendar
            if (window.currentFriendId && window.currentFriendName) {
                // For friend's calendar, force sync their Google Calendar first, then refetch events
                try {
                    const token = localStorage.getItem('jwt_token');
                    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
                    
                    // Force sync friend's calendars
                    const syncResponse = await fetch(`${API_BASE_URL}/friends/${window.currentFriendId}/sync`, {
                        method: 'POST',
                        headers
                    });
                    
                    if (syncResponse.ok) {
                        const syncData = await syncResponse.json();
                        if (syncData.success) {
                            showSuccessMessage('Friend\'s calendar synced successfully!');
                        } else {
                            showErrorMessage('Failed to sync friend\'s calendar');
                        }
                    } else {
                        showErrorMessage('Failed to sync friend\'s calendar');
                    }
                } catch (error) {
                    console.error('Failed to sync friend calendar:', error);
                    showErrorMessage('Failed to sync friend\'s calendar');
                }
                
                // Get current period from the active button
                const activePeriodBtn = document.querySelector('.period-btn.active');
                const currentPeriod = activePeriodBtn ? activePeriodBtn.dataset.period : 'today';
                
                // Refetch friend's events after sync
                await fetchFriendCalendarForPeriod(window.currentFriendId, window.currentFriendName, currentPeriod);
            } else {
                // For current user's calendar, refresh and then fetch events
                const success = await refreshCalendar();
                if (success) {
                    await fetchCalendarEvents(period, true, false);
                }
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
        
        // Add back button if viewing friend's calendar
        if (window.currentFriendId && window.currentFriendName) {
            addBackToMyScheduleButton();
        }
        
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
            
            // Check if we're currently viewing a friend's calendar
            if (window.currentFriendId && window.currentFriendName) {
                // For friend's calendar, force sync their Google Calendar first, then refetch events
                try {
                    const token = localStorage.getItem('jwt_token');
                    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
                    
                    // Force sync friend's calendars
                    const syncResponse = await fetch(`${API_BASE_URL}/friends/${window.currentFriendId}/sync`, {
                        method: 'POST',
                        headers
                    });
                    
                    if (syncResponse.ok) {
                        const syncData = await syncResponse.json();
                        if (syncData.success) {
                            showSuccessMessage('Friend\'s calendar synced successfully!');
                        } else {
                            showErrorMessage('Failed to sync friend\'s calendar');
                        }
                    } else {
                        showErrorMessage('Failed to sync friend\'s calendar');
                    }
                } catch (error) {
                    console.error('Failed to sync friend calendar:', error);
                    showErrorMessage('Failed to sync friend\'s calendar');
                }
                
                // Get current period from the active button
                const activePeriodBtn = document.querySelector('.period-btn.active');
                const currentPeriod = activePeriodBtn ? activePeriodBtn.dataset.period : 'today';
                
                // Refetch friend's events after sync
                await fetchFriendCalendarForPeriod(window.currentFriendId, window.currentFriendName, currentPeriod);
            } else {
                // For current user's calendar, refresh and then fetch events
                const success = await refreshCalendar();
                if (success) {
                    await fetchCalendarEvents(period, true, false);
                }
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

    async function renderFriendsInitials() {
        const friendsSection = document.getElementById('friends-section');
        if (!friendsSection) return;

        // Remove any previous icons (but keep the title)
        friendsSection.querySelectorAll('.friend-initials-list, .friend-icon').forEach(el => el.remove());

        const list = document.createElement('div');
        list.className = 'friend-initials-list';
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '16px';
        list.style.marginTop = '12px';

        try {
            const token = localStorage.getItem('jwt_token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            const response = await fetch('/api/friends', { headers });
            const data = await response.json();
            if (data.friends && data.friends.length > 0) {
                data.friends.forEach(friend => {
                    let initials = '?';
                    if (friend.name && friend.name.length > 0) {
                        const parts = friend.name.trim().split(' ');
                        if (parts.length === 1) {
                            initials = parts[0][0].toUpperCase();
                        } else {
                            initials = parts[0][0].toUpperCase() + parts[parts.length-1][0].toUpperCase();
                        }
                    }
                    const icon = document.createElement('div');
                    icon.className = 'friend-icon';
                    icon.textContent = initials;
                    icon.title = friend.name || friend.email;
                    icon.style.cursor = 'pointer';
                    
                    // Add click functionality to show friend's calendar
                    icon.addEventListener('click', () => {
                        fetchFriendCalendar(friend.id, friend.name);
                    });
                    
                    // Add custom tooltip functionality
                    icon.addEventListener('mouseenter', (e) => {
                        const tooltip = document.createElement('div');
                        tooltip.className = 'custom-tooltip';
                        tooltip.textContent = friend.name || friend.email;
                        tooltip.style.position = 'absolute';
                        tooltip.style.backgroundColor = '#333';
                        tooltip.style.color = 'white';
                        tooltip.style.padding = '8px 12px';
                        tooltip.style.borderRadius = '6px';
                        tooltip.style.fontSize = '14px';
                        tooltip.style.zIndex = '1000';
                        tooltip.style.pointerEvents = 'none';
                        tooltip.style.whiteSpace = 'nowrap';
                        tooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                        
                        // Position tooltip above the icon
                        const rect = icon.getBoundingClientRect();
                        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
                        tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';
                        
                        document.body.appendChild(tooltip);
                        icon._tooltip = tooltip;
                    });
                    
                    icon.addEventListener('mouseleave', () => {
                        if (icon._tooltip) {
                            icon._tooltip.remove();
                            icon._tooltip = null;
                        }
                    });
                    
                    list.appendChild(icon);
                });
            } else {
                const empty = document.createElement('div');
                empty.className = 'empty-message';
                empty.textContent = 'No friends yet';
                list.appendChild(empty);
            }
            friendsSection.appendChild(list);
        } catch (err) {
            const error = document.createElement('div');
            error.className = 'empty-message';
            error.textContent = 'Failed to load friends';
            friendsSection.appendChild(error);
            console.error('Friends initials error:', err);
        }
    }

    // Function to fetch and display friend's calendar for a specific period
    const fetchFriendCalendarForPeriod = async (friendId, friendName, period) => {
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            
            // Get date range for the period
            const { startDate, endDate } = getDateRange(period);
            
            const response = await fetch(`${API_BASE_URL}/friends/${friendId}/calendar?start=${startDate.toISOString()}&end=${endDate.toISOString()}`, { headers });
            const data = await response.json();

            if (data.success) {
                // Display friend's events
                if (data.events && data.events.length > 0) {
                    displayCalendarEvents(data.events, period, startDate, endDate);
                } else {
                    displayNoEvents(period, startDate, endDate);
                }
            } else {
                showErrorMessage('Failed to load friend\'s calendar');
            }
        } catch (error) {
            console.error('Failed to fetch friend calendar for period:', error);
            showErrorMessage('Failed to load friend\'s calendar');
        }
    };

    // Function to fetch and display friend's calendar for a custom date range
    const fetchFriendCalendarForCustomRange = async (friendId, friendName, startDateStr, endDateStr) => {
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            
            // Convert string dates to Date objects
            const startDate = new Date(startDateStr);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(endDateStr);
            endDate.setHours(23, 59, 59, 999);
            
            const response = await fetch(`${API_BASE_URL}/friends/${friendId}/calendar?start=${startDate.toISOString()}&end=${endDate.toISOString()}`, { headers });
            const data = await response.json();

            if (data.success) {
                // Display friend's events
                if (data.events && data.events.length > 0) {
                    displayCalendarEvents(data.events, 'custom', startDate, endDate);
                } else {
                    displayNoEvents('custom', startDate, endDate);
                }
            } else {
                showErrorMessage('Failed to load friend\'s calendar');
            }
        } catch (error) {
            console.error('Failed to fetch friend calendar for custom range:', error);
            showErrorMessage('Failed to load friend\'s calendar');
        }
    };

    // Function to fetch and display friend's calendar
    const fetchFriendCalendar = async (friendId, friendName) => {
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            
            // Get current date range
            const { startDate, endDate } = getDateRange('today');
            
            const response = await fetch(`${API_BASE_URL}/friends/${friendId}/calendar?start=${startDate.toISOString()}&end=${endDate.toISOString()}`, { headers });
            const data = await response.json();

            if (data.success) {
                // Update the header to show friend's name
                const userNameSpan = document.getElementById('user-name');
                if (userNameSpan) {
                    userNameSpan.textContent = `${friendName}'s Schedule`;
                }
                
                // Display friend's events
                if (data.events && data.events.length > 0) {
                    displayCalendarEvents(data.events, 'today', startDate, endDate);
                } else {
                    displayNoEvents('today', startDate, endDate);
                }
                
                // Store current friend context for navigation
                window.currentFriendId = friendId;
                window.currentFriendName = friendName;
                
                // Add a "Back to My Schedule" button
                addBackToMyScheduleButton();
            } else {
                showErrorMessage('Failed to load friend\'s calendar');
            }
        } catch (error) {
            console.error('Failed to fetch friend calendar:', error);
            showErrorMessage('Failed to load friend\'s calendar');
        }
    };

    // Function to add "Back to My Schedule" button
    const addBackToMyScheduleButton = () => {
        const calendarEventsDiv = document.getElementById('calendar-events');
        if (!calendarEventsDiv) return;

        // Remove existing back button if any
        const existingBackBtn = document.getElementById('back-to-my-schedule');
        if (existingBackBtn) {
            existingBackBtn.remove();
        }

        const backButton = document.createElement('button');
        backButton.id = 'back-to-my-schedule';
        backButton.textContent = '← Back to My Schedule';
        backButton.style.cssText = `
            background: #007bff;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            margin-bottom: 16px;
            font-size: 14px;
        `;
        
        backButton.addEventListener('click', async () => {
            // Clear friend context
            window.currentFriendId = null;
            window.currentFriendName = null;
            
            // Reset header with actual user name
            const userNameSpan = document.getElementById('user-name');
            if (userNameSpan) {
                // Fetch current user info to get the actual name
                try {
                    const token = localStorage.getItem('jwt_token');
                    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
                    const response = await fetch(`${API_BASE_URL}/auth/status`, { headers });
                    const data = await response.json();
                    
                    if (data.authenticated && data.user && data.user.name) {
                        userNameSpan.textContent = data.user.name;
                    } else {
                        userNameSpan.textContent = 'User';
                    }
                } catch (error) {
                    console.error('Failed to fetch user info:', error);
                    userNameSpan.textContent = 'User';
                }
            }
            
            // Remove back button
            backButton.remove();
            
            // Fetch and display user's own calendar
            fetchCalendarEvents();
        });

        // Insert at the beginning of the calendar events div
        calendarEventsDiv.insertBefore(backButton, calendarEventsDiv.firstChild);
    };

    renderFriendsInitials();
}); 
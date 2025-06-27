document.addEventListener('DOMContentLoaded', () => {
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

    // Event listeners for navigation
    profileBtn.addEventListener('click', showProfile);
    backBtn.addEventListener('click', showHome);

    // Event listeners
    checkAuthStatus();
    loginBtn.addEventListener('click', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);

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

    const getDateRange = (period) => {
        const now = new Date();
        let startDate, endDate;

        switch (period) {
            case 'today':
                startDate = new Date(now);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(now);
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'week':
                const dayOfWeek = now.getDay();
                const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                startDate = new Date(now);
                startDate.setDate(now.getDate() - daysToMonday);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'custom':
                // For custom, we'll use the current week as default
                const dayOfWeekCustom = now.getDay();
                const daysToMondayCustom = dayOfWeekCustom === 0 ? 6 : dayOfWeekCustom - 1;
                startDate = new Date(now);
                startDate.setDate(now.getDate() - daysToMondayCustom);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                endDate.setHours(23, 59, 59, 999);
                break;
            default:
                // Default to today
                startDate = new Date(now);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(now);
                endDate.setHours(23, 59, 59, 999);
        }

        return { startDate, endDate };
    };

    const formatDateRange = (startDate, endDate) => {
        const start = startDate.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });
        const end = endDate.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });
        
        if (startDate.toDateString() === endDate.toDateString()) {
            return start;
        }
        return `${start} - ${end}`;
    };

    const fetchCalendarEvents = async (period = 'today', useCache = true, forceSync = false, customStartDate = null, customEndDate = null) => {
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            
            let startDate, endDate;
            
            if (period === 'custom' && customStartDate && customEndDate) {
                // Use the custom dates provided
                startDate = new Date(customStartDate);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(customEndDate);
                endDate.setHours(23, 59, 59, 999);
            } else {
                // Use the predefined period ranges
                const dateRange = getDateRange(period);
                startDate = dateRange.startDate;
                endDate = dateRange.endDate;
            }

            const params = new URLSearchParams({
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                useCache: useCache.toString(),
                forceSync: forceSync.toString()
            });
            
            console.log('Fetching events with params:', params.toString());
            
            const response = await fetch(`${API_BASE_URL}/calendars/events?${params}`, { headers });
            const data = await response.json();

            console.log('Events response:', data);

            if (!data.success) {
                calendarEventsDiv.innerHTML = `<p>Error: ${data.error}</p>`;
                return;
            }

            if (!data.events || data.events.length === 0) {
                displayNoEvents(period, startDate, endDate);
                return;
            }

            displayCalendarEvents(data.events, period, startDate, endDate);
        } catch (error) {
            console.error('Failed to fetch calendar events:', error);
            calendarEventsDiv.innerHTML = '<p>Failed to fetch calendar events.</p>';
        }
    };

    const refreshCalendar = async () => {
        try {
            console.log('Starting calendar refresh...');
            
            const token = localStorage.getItem('jwt_token');
            const headers = token ? { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            } : {};
            
            const response = await fetch(`${API_BASE_URL}/calendars/sync`, {
                method: 'POST',
                headers,
                body: JSON.stringify({})
            });
            
            const data = await response.json();
            console.log('Refresh response:', data);

            if (response.status === 429) {
                // Rate limited
                showRateLimitMessage(data.retryAfter || 60);
                return false;
            }

            if (!data.success) {
                console.error('Refresh failed:', data.error);
                showErrorMessage(data.error);
                return false;
            }

            console.log('Refresh completed:', data.results);
            showSuccessMessage('Calendar refreshed successfully!');
            return true;
        } catch (error) {
            console.error('Failed to refresh calendar:', error);
            showErrorMessage('Failed to refresh calendar');
            return false;
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
}); 
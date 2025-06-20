document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userInfoDiv = document.getElementById('user-info');
    const userNameSpan = document.getElementById('user-name');
    const calendarEventsDiv = document.getElementById('calendar-events');

    console.log('Elements found:', {
        loginBtn: !!loginBtn,
        logoutBtn: !!logoutBtn,
        userInfoDiv: !!userInfoDiv,
        userNameSpan: !!userNameSpan,
        calendarEventsDiv: !!calendarEventsDiv
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
                userInfoDiv.style.display = 'block';
                
                // If user data is available, use it; otherwise show generic message
                if (data.user && data.user.name) {
                    userNameSpan.textContent = data.user.name;
                } else {
                    userNameSpan.textContent = 'User';
                }
                
                await fetchCalendarEvents();
                await fetchAvailableCalendars();
            } else {
                loginBtn.style.display = 'block';
                logoutBtn.style.display = 'none';
                userInfoDiv.style.display = 'none';
                calendarEventsDiv.innerHTML = '<p>Please log in to see your calendar events.</p>';
            }
        } catch (error) {
            console.error('Failed to check authentication status:', error);
            loginBtn.style.display = 'block';
            logoutBtn.style.display = 'none';
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
            userInfoDiv.style.display = 'none';
            calendarEventsDiv.innerHTML = '<p>Please log in to see your calendar events.</p>';
        }
    };

    // Check authentication status on page load
    checkAuthStatus();

    loginBtn.addEventListener('click', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);

    console.log('Event listeners attached');

    const fetchAvailableCalendars = async () => {
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            
            const response = await fetch(`${API_BASE_URL}/calendars/list`, { headers });
            const data = await response.json();

            if (data.error) {
                console.error('Calendar access error:', data.error);
                return;
            }

            if (!data.calendars || data.calendars.length === 0) {
                console.log('No calendars accessible:', data.message);
                return;
            }

            console.log('Available calendars:', data.calendars.map(cal => cal.summary));
        } catch (error) {
            console.error('Failed to fetch calendars:', error);
        }
    };

    const fetchCalendarEvents = async () => {
        try {
            const token = localStorage.getItem('jwt_token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            
            const response = await fetch(`${API_BASE_URL}/calendars/events`, { headers });
            const data = await response.json();

            if (data.error) {
                if (data.error.includes('403')) {
                    displayCalendarAccessDenied();
                } else {
                    calendarEventsDiv.innerHTML = `<p>Error: ${data.error}</p>`;
                }
                return;
            }

            if (data.message && data.message.includes('No calendars accessible')) {
                displayNoCalendarsAccessible();
                return;
            }

            if (!data.events || data.events.length === 0) {
                displayNoEvents();
                return;
            }

            displayCalendarEvents(data.events);
        } catch (error) {
            console.error('Failed to fetch calendar events:', error);
            calendarEventsDiv.innerHTML = '<p>Failed to fetch calendar events.</p>';
        }
    };

    const displayCalendarAccessDenied = () => {
        calendarEventsDiv.innerHTML = `
            <div class="error-message">
                <h3>🔒 Calendar Access Denied</h3>
                <p>We don't have permission to access your Google Calendar. This usually happens when:</p>
                <ul>
                    <li>You haven't granted calendar permissions to this app</li>
                    <li>Your Google account settings are restricting access</li>
                    <li>The app needs to be re-authorized</li>
                </ul>
                <p><strong>To fix this:</strong></p>
                <ol>
                    <li><a href="https://myaccount.google.com/permissions" target="_blank">Go to your Google Account permissions</a></li>
                    <li>Find this app and click "Remove access"</li>
                    <li>Log out and log back in to re-grant permissions</li>
                </ol>
            </div>
        `;
    };

    const displayNoCalendarsAccessible = () => {
        calendarEventsDiv.innerHTML = `
            <div class="no-calendars">
                <h3>📅 No Calendars Accessible</h3>
                <p>We couldn't find any calendars to access. This might be because:</p>
                <ul>
                    <li>You don't have any calendars in your Google account</li>
                    <li>Your calendars are set to private</li>
                    <li>The app doesn't have the right permissions</li>
                </ul>
                <p>Try logging out and logging back in to refresh your permissions.</p>
            </div>
        `;
    };

    const displayNoEvents = () => {
        calendarEventsDiv.innerHTML = `
            <div class="no-events">
                <h3>📅 No Events This Week</h3>
                <p>You don't have any events scheduled for this week.</p>
                <ul>
                    <li>Check if you have events in other weeks</li>
                    <li>Make sure your calendars are properly synced</li>
                    <li>Try refreshing the page</li>
                </ul>
            </div>
        `;
    };

    const displayCalendarEvents = (events) => {
        if (!events || events.length === 0) {
            displayNoEvents();
            return;
        }

        const now = new Date();
        // Get Monday as start of week (0 = Sunday, 1 = Monday, etc.)
        const dayOfWeek = now.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday, go back 6 days to Monday
        
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - daysToMonday);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const thisWeeksEvents = events.filter(event => {
            if (!event.start.dateTime) {
                // For all-day events, we can check the date part
                const eventDate = new Date(event.start.date);
                return eventDate >= startOfWeek && eventDate <= endOfWeek;
            }
            const eventDate = new Date(event.start.dateTime);
            return eventDate >= startOfWeek && eventDate <= endOfWeek;
        });

        // Format date range for display
        const startDate = startOfWeek.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const endDate = endOfWeek.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        if (thisWeeksEvents.length === 0) {
            calendarEventsDiv.innerHTML = `
                <div class="no-events">
                    <h3>📅 No Events This Week (${startDate} - ${endDate})</h3>
                    <p>You don't have any events scheduled for this week.</p>
                </div>
            `;
            return;
        }

        let html = `<h3>📅 This Week's Events (${startDate} - ${endDate})</h3>`;
        html += '<div class="events-list">';

        thisWeeksEvents.forEach(event => {
            const eventDate = event.start.dateTime ? new Date(event.start.dateTime) : new Date(event.start.date);
            const timeString = event.start.dateTime 
                ? eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                : 'All day';
            const dateString = eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            
            const calendarName = event.calendarName || 'Unknown Calendar';
            
            html += `
                <div class="event-card">
                    <div class="event-header">
                        <h3>${event.summary || 'Untitled Event'}</h3>
                        <span class="calendar-badge">📅 ${calendarName}</span>
                    </div>
                    <div class="event-time">${dateString} at ${timeString}</div>
                    ${event.description ? `<div class="event-description">${event.description}</div>` : ''}
                    ${event.location ? `<div class="event-location">📍 ${event.location}</div>` : ''}
                </div>
            `;
        });

        html += '</div>';
        calendarEventsDiv.innerHTML = html;
    };
}); 
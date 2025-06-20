# Schedule Maker

A calendar comparison and meeting scheduler app that allows users to find mutual availability and schedule meetings.

## Features

- 🔐 Google OAuth 2.0 Authentication
- 📅 Google Calendar Integration
- 👥 Multi-user Availability Comparison
- 📧 Meeting Invitations
- 🔄 Real-time Updates

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Authentication**: Google OAuth 2.0, JWT
- **Calendar API**: Google Calendar API
- **Security**: Helmet, CORS, Rate Limiting

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL
- Google Cloud Console account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd schedule-maker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Set up Google OAuth**
   - Go to [Google Cloud Console](https://console.developers.google.com/)
   - Create a new project or select existing one
   - Enable Google Calendar API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `http://localhost:3001/api/auth/google/callback`
   - Copy Client ID and Client Secret to your `.env` file

5. **Set up PostgreSQL database**
   - Install PostgreSQL if not already installed
   - Create a new database
   - Update `DATABASE_URL` in your `.env` file

6. **Run database setup**
   ```bash
   npm run setup
   ```

7. **Start the development server**
   ```bash
   npm run dev
   ```

8. **Test the API**
   ```bash
   curl http://localhost:3001/api/health
   ```

## Environment Variables

Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/schedule_maker

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# Session Configuration
SESSION_SECRET=your_session_secret_here

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

## API Endpoints

### Authentication
- `GET /api/auth/google` - Get Google OAuth URL
- `GET /api/auth/google/callback` - OAuth callback
- `POST /api/auth/refresh-token` - Refresh access token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `GET /api/auth/status` - Check authentication status

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Calendars (Coming Soon)
- `GET /api/calendars` - Get user's calendars
- `GET /api/calendars/:calendarId/events` - Get calendar events
- `POST /api/calendars/:calendarId/events` - Create calendar event

## OAuth Flow

1. **User initiates login**: Frontend calls `GET /api/auth/google`
2. **Redirect to Google**: User is redirected to Google OAuth consent screen
3. **User authorizes**: User grants permission to access calendar
4. **Google callback**: Google redirects back to `/api/auth/google/callback`
5. **Token exchange**: Backend exchanges authorization code for access/refresh tokens
6. **User creation**: User is created or updated in database
7. **JWT generation**: Backend generates JWT token for session management
8. **Redirect to frontend**: User is redirected back to frontend with JWT token

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    google_id VARCHAR(255) UNIQUE,
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Calendar Connections Table
```sql
CREATE TABLE calendar_connections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    calendar_id VARCHAR(255) NOT NULL DEFAULT 'primary',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider, calendar_id)
);
```

## Development

### Running Tests
```bash
npm test
```

### Database Migrations
```bash
npm run setup
```

### Code Structure
```
src/
├── config/
│   ├── database.js      # Database configuration
│   └── google.js        # Google OAuth configuration
├── models/
│   ├── User.js          # User model
│   └── CalendarConnection.js  # Calendar connection model
├── routes/
│   ├── auth.js          # Authentication routes
│   ├── users.js         # User management routes
│   └── calendars.js     # Calendar routes
└── server.js            # Main server file
```

## Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: API rate limiting
- **JWT**: Secure token-based authentication
- **Session Management**: Secure session handling
- **Input Validation**: Request validation
- **SQL Injection Protection**: Parameterized queries

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
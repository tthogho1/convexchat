# MapChat - Real-time Location Tracking & Chat App

A browser-based map application with real-time chat and GPS location tracking, built with React, Convex, and OpenStreetMap.

## Features

- **Real-time Chat**: Send and receive messages instantly with all connected users
- **GPS Location Tracking**: Automatically shares your location every 5 seconds
- **Live Map**: See all active users on an OpenStreetMap interface
- **Simple Authentication**: Just enter a username to get started (no OAuth required)
- **Automatic Cleanup**: Stale users and locations are automatically removed

## Tech Stack

- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **Backend**: Convex (real-time database and server functions)
- **Map**: OpenStreetMap via react-leaflet
- **Styling**: Tailwind CSS 4

## Getting Started

### 1. Start the Development Server

```bash
npm run dev
```

This will:
- Start the Vite dev server (frontend) on http://localhost:5173
- Start the Convex backend (automatically syncs your schema and functions)
- Open the app in your browser

### 2. Use the Application

1. **Enter your username** when prompted
2. **Allow location access** when your browser requests it
3. **See yourself on the map** (your marker will appear at your location)
4. **Chat with others** using the chat panel in the bottom-right
5. **Watch the map update** as other users join and move around

### 3. Test with Multiple Users

Open multiple browser windows or tabs to simulate multiple users:
- Each window can have a different username
- You'll see all users' locations on the map
- Chat messages appear in real-time across all windows

## Project Structure

```
src/
├── components/
│   ├── UsernameInput.tsx  # Initial username prompt
│   ├── MapView.tsx        # OpenStreetMap with user markers
│   └── Chat.tsx           # Collapsible chat interface
├── hooks/
│   └── useGeolocation.ts  # GPS tracking hook
├── App.tsx                # Main application component
├── main.tsx               # App entry point
└── index.css              # Global styles

convex/
├── schema.ts              # Database schema (users, locations, messages)
├── myFunctions.ts         # Backend queries and mutations
└── _generated/            # Auto-generated Convex types
```

## How It Works

### Database Schema

**users**
- `username`: User's display name
- `lastSeen`: Timestamp of last activity

**locations**
- `userId`: Reference to user
- `username`: Cached username
- `latitude` / `longitude`: GPS coordinates
- `timestamp`: When location was recorded

**messages**
- `userId`: Reference to user
- `username`: Cached username
- `text`: Message content
- `timestamp`: When message was sent

### Key Backend Functions

- `createUser`: Creates or updates a user record
- `updateLocation`: Stores user's current GPS position
- `sendMessage`: Adds a new chat message
- `getUsers`: Returns all active users (seen in last 5 minutes)
- `getLocations`: Returns all recent locations (updated in last 2 minutes)
- `getMessages`: Returns the last 50 chat messages

### Frontend Features

- **Automatic Location Updates**: The `useGeolocation` hook fetches GPS position every 5 seconds
- **Real-time Subscriptions**: Convex queries automatically update when data changes
- **Persistent Login**: Username and user ID stored in localStorage
- **Map Auto-centering**: Map centers on your location when it updates

## Configuration

The app uses environment variables from `.env.local`:

- `VITE_CONVEX_URL`: Your Convex deployment URL (already configured)
- WorkOS variables are no longer needed (we removed OAuth authentication)

## Customization Ideas

- **Change update interval**: Edit the `5` in `useGeolocation(userId, 5)` (src/App.tsx:18)
- **Adjust map zoom**: Change `zoom={13}` in MapView.tsx
- **Modify message limit**: Update `limit: 50` in the getMessages query
- **Change marker icons**: Customize the Leaflet icon styles in MapView.tsx
- **Add user avatars**: Extend the users table with avatar URLs
- **Add typing indicators**: Use Convex presence for "user is typing" status

## Troubleshooting

**Location not working?**
- Ensure you clicked "Allow" when prompted for location access
- Check browser console for geolocation errors
- HTTPS is required for geolocation in production (works on localhost)

**Map not displaying?**
- Check that Leaflet CSS is loading (should see styled map tiles)
- Verify you have an active internet connection (map tiles load from OpenStreetMap)

**Chat not updating?**
- Verify Convex backend is running (`npm run dev` starts both frontend and backend)
- Check browser console for Convex connection errors

## Production Deployment

1. Deploy Convex backend:
   ```bash
   npx convex deploy
   ```

2. Update `.env.production` with your production Convex URL

3. Build frontend:
   ```bash
   npm run build
   ```

4. Deploy the `dist/` folder to your hosting provider (Vercel, Netlify, etc.)

## Privacy & Security Notes

- User locations are stored in the Convex database
- No authentication means anyone can join with any username
- Consider adding rate limiting for production use
- HTTPS is required for geolocation in production environments
- Locations older than 2 minutes are automatically filtered out (not deleted, just hidden)

## Next Steps

Want to enhance the app? Consider adding:
- User authentication (email/password or OAuth)
- Private/group chats
- Location history and trails
- Distance calculations between users
- Push notifications for new messages
- Offline support with service workers

Enjoy building with MapChat!

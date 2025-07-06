# Cactus
```
    ,*-.
    |  |
,.  |  |
| |_|  | ,.
`---.  |_| |
    |  .--`
    |  |
    |  | 

```

Extremely minimal randomized order media reviewer built with React

## Features

- **Media Display**: Shows images and videos from a specified directory in randomized order
- **Navigation**: Arrow keys and touch gestures (swipe up/down) to navigate through media
- **Media Filtering**: Filter by all media, photos only, or videos only
- **Directory Rescanning**: Ability to rescan the directory for new files
- **Video Controls**: Play/pause, progress bar, fullscreen support
- **Touch Gestures**: Swipe up/down navigation with visual feedback
- **Preloading**: Preloads adjacent media files for smooth navigation
- **Responsive Design**: Works on mobile and desktop
- **SQLite Storage**: Content-based file identification that survives moves and renames
- **Enhanced Performance**: Fast database queries and optimized file scanning

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the application:**
   ```bash
   npm start -- -d /path/to/your/media/directory -p 3000
   ```

3. **Open your browser and go to http://localhost:3000**

## Usage

### Production

```bash
# Build and start the server
npm start -- -d /path/to/your/media/directory -p 3000
```

### Development

```bash
# Start development server with hot reloading
npm run dev

# In another terminal, start the backend
node src/server.js -d /path/to/your/media/directory -p 3000

# Open http://localhost:3001 for development with hot reloading
```

### Development with test data

```bash
# Start both frontend and backend for development
npm run start:dev
```

## Navigation

- **Arrow Keys**: Up/Down or Left/Right arrows to navigate
- **Touch Gestures**: Swipe up for next, swipe down for previous
- **Navigation Buttons**: Click the ↑/↓ buttons in the bottom navigation bar

## Settings

Click the ⋯ button to access:
- **Media Type Filter**: Switch between All, Photos, or Videos
- **Rescan Directory**: Refresh the media file list

## Docker

Deploy using Docker:

```bash
# Build the Docker image
docker build -t cactus-media-server .

# Run the container
docker run -p 3000:3000 -v /path/to/your/media/directory:/media cactus-media-server
```

## Architecture

Built with modern React architecture and SQLite for robust data persistence:

### **Storage System**
- **SQLite Database**: Persistent storage with content-based file identification
- **Content Hashing**: Files identified by SHA-256 hash of content (survives moves/renames)
- **WAL Mode**: Write-Ahead Logging for better concurrent performance
- **Automatic Cleanup**: Orphaned file records are automatically removed

### **Components**
- `App.jsx` - Main application with state management
- `MediaViewer.jsx` - Media display and touch gesture handling
- `MediaItem.jsx` - Individual media items with animations
- `Navigation.jsx` - Bottom navigation bar
- `SettingsPanel.jsx` - Settings overlay
- `VideoProgressBar.jsx` - Video progress indicator

### **Custom Hooks**
- `useMediaFiles.js` - Media loading, filtering, and rescanning
- `useTouchGestures.js` - Smooth swipe navigation
- `useKeyboardNavigation.js` - Arrow key navigation
- `useMediaPreloader.js` - Adjacent media preloading
- `useMobileViewport.js` - Mobile viewport optimization

### **Database Layer**
- `database/index.js` - SQLite database service
- `mediaScannerSQLite.js` - Enhanced media scanner with database integration

### **File Structure**
```
src/
├── components/         # React components
├── hooks/              # Custom React hooks
├── database/           # Database service and migrations
├── utils/              # Utility functions
├── App.jsx             # Main application
├── main.jsx            # React entry point
├── index.html          # HTML template
├── index.css           # Styles with Tailwind CSS
├── server.js           # Express server
└── mediaScannerSQLite.js # SQLite-based media scanner
```

## API Endpoints

- `GET /get-media-files?type=all|photos|videos` - Get filtered media files
- `GET /filter-media?type=all|photos|videos` - Filter existing media files
- `POST /rescan-directory` - Rescan directory for new files
- `GET /media?path=<filepath>` - Serve media files
- `GET /api/stats` - Get database statistics and file counts

## Database Schema

The SQLite database stores media files with content-based identification:

```sql
-- Media files with content hashing for persistent identification
CREATE TABLE media_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_hash TEXT UNIQUE NOT NULL,           -- SHA-256 content hash
    file_path TEXT NOT NULL,                  -- Current file path
    filename TEXT NOT NULL,                   -- Original filename
    file_size INTEGER NOT NULL,               -- File size in bytes
    media_type TEXT NOT NULL,                 -- 'image' or 'video'
    date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Requirements

- Node.js 16.0.0 or higher
- Modern web browser with ES6+ support
- Directory with supported media files (jpg, png, gif, mp4, webm, etc.)

## License

MIT

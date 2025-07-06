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

Built with modern React architecture for maintainability and performance:

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

### **File Structure**
```
src/
├── components/         # React components
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
├── App.jsx             # Main application
├── main.jsx            # React entry point
├── index.html          # HTML template
├── index.css           # Styles with Tailwind CSS
├── server.js           # Express server
└── mediaScanner.js     # Media file scanning logic
```

## API Endpoints

- `GET /get-media-files?type=all|photos|videos` - Get filtered media files
- `GET /filter-media?type=all|photos|videos` - Filter existing media files
- `POST /rescan-directory` - Rescan directory for new files
- `GET /media?path=<filepath>` - Serve media files

## Requirements

- Node.js 16.0.0 or higher
- Modern web browser with ES6+ support
- Directory with supported media files (jpg, png, gif, mp4, webm, etc.)

## License

MIT

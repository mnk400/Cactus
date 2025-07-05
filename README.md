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

Extremely minimal randomized order media reviewer

## Features

- **Media Display**: Shows images and videos from a specified directory in randomized order
- **Navigation**: Arrow keys and touch gestures (swipe up/down) to navigate through media
- **Media Filtering**: Filter by all media, photos only, or videos only
- **Directory Rescanning**: Ability to rescan the directory for new files
- **Video Controls**: Play/pause, progress bar, fullscreen support
- **Touch Gestures**: Swipe up/down navigation with visual feedback
- **Preloading**: Preloads adjacent media files for smooth navigation
- **iOS Safari Support**: Handles iOS bottom bar behavior
- **Responsive Design**: Works on mobile and desktop

## Usage

### Original HTML Version (Default)

1. Install dependencies:
   ```
   npm install
   ```

2. Start the server with a directory path:
   ```
   npm start -- -d /path/to/your/media/directory -p 3000
   ```
   Or directly using node:
   ```
   node src/server.js -d /path/to/your/media/directory -p 3000
   ```

3. Open your browser and go to http://localhost:3000

### React Version (New!)

The application has been migrated to React for better maintainability and component reusability.

1. Build the React application:
   ```
   npm run build:react
   ```

2. Start the server with React version:
   ```
   npm run start:react -- -d /path/to/your/media/directory -p 3000
   ```
   Or directly:
   ```
   node src/server.js --react -d /path/to/your/media/directory -p 3000
   ```

3. Open your browser and go to http://localhost:3000

### Development Mode (React)

For React development with hot reloading:

1. Start the development server:
   ```
   npm run dev:react
   ```
   This runs Vite dev server on port 3001 with API proxying to port 3000.

2. In another terminal, start the backend server:
   ```
   node src/server.js -d /path/to/your/media/directory -p 3000
   ```

3. Open your browser and go to http://localhost:3001

## Navigation

- **Arrow Keys**: Up/Down or Left/Right arrows to navigate
- **Touch Gestures**: Swipe up for next, swipe down for previous
- **Navigation Buttons**: Click the ↑/↓ buttons in the bottom navigation bar

## Settings

Click the ⋯ button to access:
- **Media Type Filter**: Switch between All, Photos, or Videos
- **Rescan Directory**: Refresh the media file list

## Docker

Can also be deployed through docker using the included dockerfile:

```bash
# Original HTML version
docker build -t cactus-media-server .
docker run -p 3000:3000 -v /path/to/your/media/directory:/media cactus-media-server

# React version (build first)
npm run build:react
docker build -t cactus-media-server .
docker run -p 3000:3000 -v /path/to/your/media/directory:/media -e USE_REACT=true cactus-media-server
```

## React Migration

The React version maintains 100% feature parity with the original HTML version while providing:

### Benefits
- **Component-based architecture**: Reusable UI components
- **Better state management**: Centralized state with custom hooks
- **Improved maintainability**: Separated concerns and cleaner code organization
- **Type safety**: Better development experience with modern tooling
- **Hot reloading**: Faster development iteration

### Architecture
- **Components**: Modular UI components (`MediaViewer`, `Navigation`, `SettingsPanel`, etc.)
- **Custom Hooks**: Reusable logic (`useMediaFiles`, `useTouchGestures`, `useKeyboardNavigation`, etc.)
- **Utils**: Helper functions for media type detection and array shuffling
- **Build System**: Vite for fast development and optimized production builds

### File Structure
```
src/
├── react/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── utils/          # Utility functions
│   │   ├── App.jsx         # Main application component
│   │   └── main.jsx        # React entry point
│   ├── index.html          # HTML template
│   └── public/             # Static assets
├── server.js               # Express server (supports both versions)
└── views/                  # Original HTML version
```

Both versions use the same backend API and media scanning functionality.

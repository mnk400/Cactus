# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cactus is a minimal randomized media viewer built with React (frontend) and Express/Bun (backend). It displays images and videos from configurable sources with features like tagging, gallery view, and keyboard/touch navigation.

## Commands

```bash
# Install dependencies
bun install

# Development (frontend + backend concurrently with hot reload)
bun run start:dev

# Production build and run
bun start -- -d /path/to/media -p 3000

# Frontend only (Vite dev server on port 3001)
bun run dev

# Build React app to dist/
bun run build

# Format code
bun run format
```

**Server CLI flags:**

- `-d <path>`: Media directory (required for local provider)
- `-p <port>`: Server port (default: 3000)
- `--provider <type>`: Provider type (default: local)
- `--keyphrase <phrase>`: Enable simple authentication

## Architecture

### Frontend (React + Vite)

- **Entry**: `src/main.jsx` → `src/App.jsx`
- **State Management**: `src/context/MediaContext.jsx` - central state for media files, filters, tags, and settings
- **Custom Hooks**: `src/hooks/` - keyboard navigation, favorites, media preloading, tags, URL sync
- **Components**: `src/components/` - MediaViewer, GalleryView, Navigation, SettingsPanel, TagManager

### Backend (Express on Bun)

- **Entry**: `src/server.js` - Express server with API routes
- **Provider System**: `src/providers/` - pluggable media sources
  - `MediaSourceProvider.js` - abstract base class defining the provider interface
  - `LocalMediaProvider.js` - scans local filesystem directories
  - `ProviderFactory.js` - creates provider instances based on config

### Key Patterns

- **Provider Pattern**: All media sources implement `MediaSourceProvider` interface with methods for `getAllMedia()`, `getMediaByTags()`, tag CRUD, `serveThumbnail()`, etc.
- **URL State Sync**: Filter settings (mediaType, tags, sortBy) sync bidirectionally with URL parameters via `useURLSettings` hook
- **API Routes**: `/api/media`, `/api/tags`, `/api/config`, `/api/auth/*`

### Build Pipeline

- Vite builds React app to `/dist`
- Express serves static files from `/dist` and API routes
- Dev mode: Vite proxy forwards API calls from port 3001 → 3000

## Requirements

- Bun 1.0.0+
- FFmpeg (for video thumbnails)

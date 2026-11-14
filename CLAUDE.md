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
- **Custom Hooks**: `src/hooks/` - keyboard navigation, per-item tags, URL sync
- **Components**: `src/components/` - unified media browser (feed + gallery), floating dock, one panel track (tags / filter / settings)
- **Layout**: where things sit is CSS in `src/index.css`, picked by viewport orientation; components take no breakpoint or orientation props. `Sheet.jsx` (the dock that grows into the open panel) only animates its own size and floats over the stage, which never resizes for it
- **Gallery**: `Gallery.jsx` computes the masonry layout itself from each item's stored width/height (so any tile's position is exact before it is drawn) and only draws tiles near the viewport. The feed↔gallery zoom is one photo moved on a spring in `UnifiedMediaBrowser.jsx`, reading both ends every frame; there are no View Transitions
- **Finish**: surfaces and controls are painted from tokens in `src/index.css` (`.surface`, `.well`, `.pill`, `.lit`, …); `data-skin="matte"` on `<html>` swaps the default Soft finish for Matte (`src/utils/prefs.js`, which also holds the video-progress toggle)

### Backend (Express on Bun)

- **Entry**: `src/server.js` - Express server with API routes
- **Provider System**: `src/providers/` - pluggable media sources
  - `MediaSourceProvider.js` - abstract base class defining the provider interface
  - `LocalMediaProvider.js` - scans local filesystem directories
  - `ProviderFactory.js` - creates provider instances based on config

### Key Patterns

- **Provider Pattern**: All media sources implement `MediaSourceProvider` interface with methods for `getAllMedia()`, `getMediaByTags()`, tag CRUD, `serveThumbnail()`, etc.
- **URL State Sync**: Filter settings (mediaType, tags, sortBy, seed) sync bidirectionally with URL parameters via `useURLSettings` hook
- **The order is one module**: providers return items in any order, and the server orders every list with `src/order.js` (random: a hash of the seed and each item's id, `/api/media?sortBy=random&seed=N`; dates: newest first, undated last; ties by id). The client uses the same module to land on the next item when a filter hides the current one. What the list is (filters, sort, seed) is described once in `src/utils/filters.js`: a filter is anything that hides items, sort is not one. Items never move relative to each other as the library grows or shrinks, and a filtered list keeps the full list's order. The seed lives in the URL, so reloads, back/forward and clearing a filter keep the order, and nothing on the client stores a copy of the list
- **No caches**: nothing caches data on purpose. The server has no response cache, media/thumbnails/assets revalidate by ETag, and there is no service worker (`public/sw.js` only removes the one older versions installed). The feed's preloading is just the ±2 items it renders. The one cache is the sb provider's thumbnail folder (`.cactus-cache/thumbs`; remote fetch or ffmpeg per miss), emptied by "regenerate thumbnails". Add a cache only with a strong reason, and give it a way to be emptied
- **API Routes**: `/api/media`, `/api/tags`, `/api/config`, `/api/auth/*`

### Build Pipeline

- Vite builds React app to `/dist`
- Express serves static files from `/dist` and API routes
- Dev mode: Vite proxy forwards API calls from port 3001 → 3000

## Requirements

- Bun 1.0.0+
- FFmpeg (for video thumbnails)

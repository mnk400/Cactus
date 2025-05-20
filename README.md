# Cactus Style Media Viewer

A web application that allows you to browse images and videos from a local directory in a one-by-one interface in a completely random order

## Features

- Recursively scans directories for media files (images and videos)
- Displays media in a randomized order
- Supports keyboard, button, and swipe navigation
- Works with common image formats (jpg, jpeg, png, gif, bmp, webp)
- Works with common video formats (mp4, webm, ogg, mov, avi, mkv)

## How to Use

1. Install dependencies:
   ```
   npm install
   ```

2. Start the server with a directory path:
   ```
   npm start -- /path/to/your/media/directory
   ```
   Or directly using node:
   ```
   node server.js /path/to/your/media/directory
   ```

3. Open your browser and go to http://localhost:3000

4. The application will automatically load and display media files from the specified directory

5. Navigate through the media using:
   - Up/Down arrow keys
   - Navigation buttons on the right side
   - Swipe up/down on touch devices

## Supported Media Types

- Images: jpg, jpeg, png, gif, bmp, webp
- Videos: mp4, webm, ogg, mov, avi, mkv
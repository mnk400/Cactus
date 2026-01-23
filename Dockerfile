FROM oven/bun:1-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache ffmpeg

# Copy package files
COPY package.json ./

# Install dependencies
RUN bun install

# Copy config files
COPY vite.config.js ./
COPY tailwind.config.js ./
COPY postcss.config.cjs ./

# Copy source code
COPY src/ ./src/

# Build the React application
RUN bun run build

# Create configuration directory
RUN mkdir -p configuration

# Expose port
EXPOSE 3000

# Start the server
CMD ["bun", "src/server.js", "-d", "/media"]

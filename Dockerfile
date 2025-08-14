FROM oven/bun:1-alpine

WORKDIR /app

RUN apk add --no-cache ffmpeg

# Copy package files
COPY package*.json ./
COPY bun.lockb* ./
COPY vite.config.js ./
COPY tailwind.config.js ./
COPY postcss.config.js ./

# Install dependencies
RUN bun install

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

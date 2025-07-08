FROM node:lts-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY vite.config.js ./
COPY tailwind.config.js ./
COPY postcss.config.js ./

# Install dependencies
RUN npm install

# Copy source code
COPY src/ ./src/

# Build the React application
RUN npm run build

# Create configuration directory
RUN mkdir -p configuration

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "src/server.js", "-d", "/media", "$@"]

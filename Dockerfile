FROM node:lts-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY src/ ./src/
RUN mkdir -p configuration
EXPOSE 3000

ENTRYPOINT ["node", "src/server.js", "-d", "/media"]
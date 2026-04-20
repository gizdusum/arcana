FROM node:20-alpine

# Install build tools needed for better-sqlite3 native addon
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY .env.example .env.example

RUN mkdir -p data

ENV NODE_ENV=production

# Expose HERMES API port
EXPOSE 3001

CMD ["node", "dist/index.js"]

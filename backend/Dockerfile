FROM node:20-alpine

WORKDIR /app

# Install openssl for Prisma support on Alpine Linux
RUN apk add --no-cache openssl

# Install dependencies with caching layer
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Copy TypeScript configuration and source code
COPY tsconfig.json ./
COPY src ./src/

# Generate Prisma Client and compile TypeScript into dist/
RUN npx prisma generate
RUN npm run build

# Expose backend REST API port
EXPOSE 5000

# Deploy pending migrations and start production server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app

# argon2 needs native bindings
RUN apk add --no-cache libc6-compat

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 4000

# Run seed on startup then start API
CMD ["sh", "-c", "node dist/seed.js || echo 'Seed skipped or failed'; node dist/index.js"]

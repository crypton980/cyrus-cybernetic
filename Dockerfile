FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Copy built client assets
COPY --from=builder /app/dist ./dist
# Copy server source (tsx runs TypeScript directly in production)
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/standalone ./standalone
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/tsconfig.server.json ./tsconfig.server.json
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

EXPOSE 3105

ENV NODE_ENV=production
ENV PORT=3105

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -qO- http://localhost:3105/__health || exit 1

CMD ["npm", "start"]

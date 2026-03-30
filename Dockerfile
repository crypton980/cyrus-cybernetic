FROM node:20-alpine AS builder

WORKDIR /app

# Install Python and build dependencies for the builder stage
RUN apk add --no-cache python3 py3-pip python3-dev build-base

# Install Python dependencies into a virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir numpy scipy scikit-learn networkx matplotlib pandas nltk

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

# Install Python 3 runtime in the final image so Python processes can be spawned
RUN apk add --no-cache python3

# Copy the pre-built virtual environment with all Python packages from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

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

EXPOSE 3105 5001 5002

ENV NODE_ENV=production
ENV PORT=3105

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:3105/__health || exit 1

CMD ["npm", "start"]

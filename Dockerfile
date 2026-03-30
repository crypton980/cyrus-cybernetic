FROM node:20-alpine AS builder

WORKDIR /app

# Install Python and build dependencies for the builder stage
RUN apk add --no-cache python3 py3-pip python3-dev build-base

# Install Python dependencies into a virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
# Install legacy Python services AND the CYRUS AI microservice dependencies
RUN pip install --no-cache-dir numpy scipy scikit-learn networkx matplotlib pandas nltk
COPY cyrus-ai/requirements.txt /tmp/cyrus-ai-requirements.txt
RUN pip install --no-cache-dir -r /tmp/cyrus-ai-requirements.txt

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

# Install Python 3 runtime and pip in the final image
RUN apk add --no-cache python3 py3-pip

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
# Copy Python AI microservice
COPY --from=builder /app/cyrus-ai ./cyrus-ai

EXPOSE 3105 8001

ENV NODE_ENV=production
ENV PORT=3105
ENV CYRUS_AI_URL=http://localhost:8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD wget -qO- http://localhost:3105/__health || exit 1

# Start both services with a simple monitor: if the AI service dies, the
# container log captures it but Node.js continues serving.  The health check
# on port 3105 (Node) is what orchestrators use to determine container health.
# For production HA deployments, run the AI service as a separate container.
CMD ["sh", "-c", "cd /app/cyrus-ai && uvicorn api:app --host 0.0.0.0 --port 8001 --workers 1 --log-level warning & AI_PID=$!; trap 'kill $AI_PID 2>/dev/null; exit 0' TERM INT; exec npm start"]\

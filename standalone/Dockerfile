FROM node:20-slim AS base

RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv \
    build-essential \
    cairo-dev \
    ffmpeg \
    ghostscript \
    pkg-config \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir numpy scipy scikit-learn networkx matplotlib pandas mmh3 nltk

WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --include=dev

FROM deps AS build
COPY . .
RUN npm run build

FROM base AS production
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm install tsx typescript

COPY . .
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5000/__health || exit 1

CMD ["npx", "tsx", "server/index.ts"]

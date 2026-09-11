# Stage 1: Build & Compile TypeScript
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy package files for clean dependency install
COPY package*.json ./

RUN npm ci

# Copy source code and configuration
COPY tsconfig.json ./
COPY src/ ./src/
COPY config/ ./config/

# Compile TypeScript to dist/
RUN npm run build

# Remove development dependencies for a lean production image
RUN npm prune --production

# Stage 2: Production Runner
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# Install curl for reliable health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

# Copy production node_modules (with glibc-compatible native onnx binaries), compiled dist, and required configs
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config ./config

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]

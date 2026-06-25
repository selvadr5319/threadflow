# ─────────────────────────────────────────────
#  Stage 1: Build
# ─────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ─────────────────────────────────────────────
#  Stage 2: Production image
# ─────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# Only production deps
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Non-root user + persistent data directory
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
 && mkdir -p /app/data && chown appuser:appgroup /app/data

USER appuser

ENV SQLITE_PATH=/app/data/data.sqlite

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/app.js"]

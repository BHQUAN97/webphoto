FROM node:20-slim AS base

# Install dcraw for RAW image decoding
RUN apt-get update && apt-get install -y --no-install-recommends \
    dcraw \
    libraw-bin \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy compiled JS (build locally or in CI before Docker build)
COPY dist/ ./dist/

# Default env
ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["node", "dist/index.js"]

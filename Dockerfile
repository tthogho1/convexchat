# syntax=docker/dockerfile:1.7

# ---------- Stage 1: Build the Vite/React app & deploy Convex backend ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps with a clean, reproducible install
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source
COPY . .

# Build the Vite/React app using an inlined Convex URL.
#
# For development deployments we pass `VITE_CONVEX_URL` as a build-arg so
# the dev Convex URL is embedded into the static bundle at build time.
#
# Local build:
#   DOCKER_BUILDKIT=1 docker build \
#     --build-arg VITE_CONVEX_URL=https://confident-aardvark-288.convex.cloud \
#     -t convexchat .
#
# Fly.io build (uses fly.toml [build.args] below):
ARG VITE_CONVEX_URL
ENV VITE_CONVEX_URL=$VITE_CONVEX_URL

# Run the usual frontend build which will inline VITE_* env vars into the bundle
RUN npm run build

# ---------- Stage 2: Serve static files with nginx ----------
FROM nginx:1.27-alpine AS runner

# SPA-friendly nginx config (fallback to index.html for client-side routing)
RUN printf '%s\n' \
    'server {' \
    '  listen 80;' \
    '  server_name _;' \
    '  root /usr/share/nginx/html;' \
    '  index index.html;' \
    '  gzip on;' \
    '  gzip_types text/plain text/css application/javascript application/json image/svg+xml;' \
    '  location / {' \
    '    try_files $uri $uri/ /index.html;' \
    '  }' \
    '  location ~* \.(?:js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico|webp)$ {' \
    '    expires 30d;' \
    '    add_header Cache-Control "public, immutable";' \
    '  }' \
    '}' \
    > /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]

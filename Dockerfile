# Multi-stage build: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY scripts/generate-asset-manifests.mjs ./scripts/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine


# Copy built app to Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Install cloudflared
RUN apk add --no-cache curl tar && \
    curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.tar.gz -o cloudflared.tar.gz && \
    tar -xzf cloudflared.tar.gz && \
    mv cloudflared /usr/local/bin/ && \
    rm cloudflared.tar.gz

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80 for Nginx
EXPOSE 80

# Start Nginx and Cloudflare Tunnel
CMD ["sh", "-c", "nginx -g 'daemon off;' & cloudflared tunnel --token $TUNNEL_TOKEN run quest-360-app-tunnel"]
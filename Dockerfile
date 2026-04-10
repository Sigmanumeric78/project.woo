# ─────────────────────────────────────────────────────────────────────────────
# SocialSpaces — Production Docker Image
# Serves the static web app via nginx:alpine with custom config.
# Usage:
#   docker build -t socialspaces .
#   docker run -p 8080:80 socialspaces
#   docker compose up          (production)
#   docker compose --profile dev up  (live-reload dev)
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1: Collect static assets from the repo
FROM alpine:3.19 AS build

WORKDIR /app

# Copy everything (respects .dockerignore)
COPY . .

# Remove any server-side / dev files not needed in the image
RUN rm -rf \
    .git .gitignore .vscode .firebase \
    .firebaserc firebase.json \
    firestore.rules firestore.indexes.json \
    extract_district_state.py \
    All_India_pincode_NO_GEOMETRY.json \
    README.md \
    docker-compose.yml \
    nginx.conf \
    Dockerfile \
    .dockerignore

# Stage 2: Serve with nginx:alpine
FROM nginx:1.27-alpine AS production

LABEL maintainer="SocialSpaces Team"
LABEL version="2.0"
LABEL description="SocialSpaces — hyper-local social matching platform"

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy static files from build stage
COPY --from=build /app /usr/share/nginx/html/

# Remove default nginx configs that conflict with ours
RUN rm -f /etc/nginx/conf.d/default.conf

# Create non-root user for nginx worker processes
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Expose HTTP
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]

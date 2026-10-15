# npm packages
FROM --platform=$BUILDPLATFORM node:24-alpine AS builder

# build tools in case native modules (better-sqlite3) need compiling
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY website/* /app
RUN npm install
ENV NUXT_PUBLIC_OPEN_FETCH_API_BASE_URL="/api/"
RUN npm run generate

# Serve stage
FROM nginx:alpine3.22-slim

COPY --from=builder /app/.output/public /usr/share/nginx/html
COPY ./nginx /etc/nginx

EXPOSE 80
ENV API_URL=http://tranga-api:6531
CMD ["nginx", "-g", "daemon off;"]

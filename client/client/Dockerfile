# ---- Build the SPA ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Vite reads env at build time (from .env.production in repo)
RUN npm run build

# ---- Serve with Nginx, listen on $PORT ----
FROM nginx:alpine
# We'll generate the nginx config at container start using $PORT
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Default (Cloud Run sets PORT anyway)
ENV PORT=8080

EXPOSE 8080
# Render template -> default.conf, then start nginx
CMD ["/bin/sh","-c","envsubst '$$PORT' </etc/nginx/templates/default.conf.template >/etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
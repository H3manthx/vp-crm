# ---- Build the SPA ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci

# build-time inputs (must be BEFORE npm run build)
ARG VITE_API_URL
ARG VITE_FILE_BASE
ENV VITE_API_URL=https://vp-crm-231901109740.asia-south1.run.app/api
ENV VITE_FILE_BASE=https://vp-crm-231901109740.asia-south1.run.app/app

COPY . .
RUN npm run build

# ---- Serve with Nginx (listen on $PORT for Cloud Run) ----
FROM nginx:alpine
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV PORT=8080
EXPOSE 8080
CMD ["/bin/sh","-c","envsubst '$$PORT' </etc/nginx/templates/default.conf.template >/etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]

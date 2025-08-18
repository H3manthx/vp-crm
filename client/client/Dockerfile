# ---- Build the SPA ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Vite reads env at build time:
# You'll pass VITE_API_BASE_URL when building (see commands below).
RUN npm run build

# ---- Serve with Nginx ----
FROM nginx:alpine
# Minimal SPA config with history fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx","-g","daemon off;"]

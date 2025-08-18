# ---- Base deps (production) ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Installs production deps only (dev deps are only nodemon/knex)
RUN npm ci --omit=dev

# ---- Runtime ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copy node_modules and source
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Expose the port your app listens on (defaults to 4000)
EXPOSE 4000

# If your app expects PORT, set a default (can be overridden in K8s)
ENV PORT=4000

# Start the server
CMD ["node", "src/index.js"]
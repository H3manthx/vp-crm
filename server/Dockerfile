# ---- Base deps (production) ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ---- Runtime ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Cloud Run expects 8080
EXPOSE 8080

# ⚠️ Remove the hard-coded PORT. Let Cloud Run inject it.
# ENV PORT=4000   <-- delete this line

CMD ["node", "src/index.js"]
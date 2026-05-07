FROM node:20-alpine AS base
WORKDIR /home/node/app

# Dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Source
COPY . .

# Logs directory
RUN mkdir -p logs && chown -R node:node /home/node/app

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

CMD ["node", "server.js"]

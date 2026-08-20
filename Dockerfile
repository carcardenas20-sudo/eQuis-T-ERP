FROM node:22-slim

# Solo ca-certificates (para TLS). Ya NO instalamos Chromium: se quitó el bot de WhatsApp
# para bajar el costo (Chromium 24/7 era lo que disparaba la RAM/factura de Railway).
RUN apt-get update && apt-get install -y \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

CMD ["node", "server/index.js"]

FROM node:24-bookworm-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:local

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
COPY deploy/runtime/package*.json ./
RUN npm ci --omit=dev
COPY --from=web /app/dist-mcp ./dist-mcp
USER 10001:10001
CMD ["node", "dist-mcp/runtime.mjs"]

FROM python:3.14-slim-bookworm AS bridge
RUN apt-get update && apt-get install -y --no-install-recommends libusb-1.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY bridge ./bridge
RUN pip install --no-cache-dir ./bridge && mkdir /data && chown 10001:10001 /data
COPY --from=web /app/dist ./dist
USER 10001:10001
CMD ["petes-printer", "--container-network", "--host", "0.0.0.0", "--no-runtime", "--data-dir", "/data", "--web-dist", "/app/dist"]

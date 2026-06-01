FROM node:20-alpine AS server-build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS web-build
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV LEDGERFLOW_DB=/data/ledgerflow.sqlite
ENV LEDGERFLOW_SERVE_WEB=1
ENV LEDGERFLOW_WEB_ROOT=/app/web/dist
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=server-build /app/dist ./dist
COPY --from=web-build /app/web/dist ./web/dist
COPY examples ./examples
RUN addgroup -S -g 10001 ledgerflow \
  && adduser -S -D -H -u 10001 -G ledgerflow ledgerflow \
  && mkdir -p /data \
  && chown -R ledgerflow:ledgerflow /data
USER ledgerflow
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/cli/index.js", "serve", "--port", "3000"]

FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293

WORKDIR /app

ENV LEDGERFLOW_DB=/data/ledgerflow.sqlite
ENV LEDGERFLOW_SERVE_WEB=1
ENV LEDGERFLOW_WEB_ROOT=/app/web/dist

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm ci --prefix web \
  && npm run build \
  && npm --prefix web run build \
  && addgroup -S -g 10001 ledgerflow \
  && adduser -S -D -H -u 10001 -G ledgerflow ledgerflow \
  && mkdir -p /data \
  && chown -R ledgerflow:ledgerflow /app /data

USER ledgerflow
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/cli/index.js", "serve", "--port", "3000"]

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts/prepare-map-assets.mjs ./scripts/prepare-map-assets.mjs
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_MAP_STYLE_URL
ENV NEXT_PUBLIC_MAP_STYLE_URL=$NEXT_PUBLIC_MAP_STYLE_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run data:sync -- --files-only
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/data ./data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
FROM node:20-slim AS build

WORKDIR /app
RUN corepack enable && corepack prepare yarn@3.6.4 --activate

COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable

COPY . .
ARG VITE_DEFAULT_TENANT_SLUG
ENV VITE_DEFAULT_TENANT_SLUG=${VITE_DEFAULT_TENANT_SLUG} \
    DISABLE_VISUAL_EDITS=true \
    DISABLE_EMERGENT_OVERLAY=true
RUN yarn build

FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

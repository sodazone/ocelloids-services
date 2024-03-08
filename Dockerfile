FROM node:20-alpine AS builder

WORKDIR /opt/xcmon

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
COPY packages/server/package.json packages/server/tsconfig.json ./packages/server/
COPY packages/server/src ./packages/server/src

RUN yarn install

RUN mkdir -p chain-specs config && \
yarn run server build && \
yarn cache clear && \
rm -rf node_modules/ && \
yarn workspaces focus --production xcmon-server

FROM node:20-alpine AS runner

LABEL org.opencontainers.image.source=https://github.com/sodazone/xcm-monitoring
LABEL org.opencontainers.image.description="Ocelloids XCM Monitoring Server"

WORKDIR /opt/xcmon

ENV NODE_ENV=production
ENV XCMON_HOST=0.0.0.0
EXPOSE 3000

COPY --from=builder /opt/xcmon/node_modules ./node_modules
COPY --from=builder /opt/xcmon/packages/server/package.json /opt/xcmon/packages/server/dist ./

ENTRYPOINT ["node", "main.js"]

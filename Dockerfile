FROM node:20-alpine AS builder

WORKDIR /opt/oc

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
yarn workspaces focus --production @sodazone/ocelloids-service-node

FROM node:20-alpine AS runner

LABEL org.opencontainers.image.authors="oc@soda.zone"
LABEL org.opencontainers.image.source=https://github.com/sodazone/ocelloids-services
LABEL org.opencontainers.image.description="Ocelloids Integrated Node"

WORKDIR /opt/oc

ENV NODE_ENV=production
ENV OC_HOST=0.0.0.0
EXPOSE 3000

COPY --from=builder /opt/oc/node_modules ./node_modules
COPY --from=builder /opt/oc/packages/server/package.json /opt/oc/packages/server/dist ./

ENTRYPOINT ["node", "main.js"]

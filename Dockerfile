ARG NODE_IMAGE=node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS build
WORKDIR /app


COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci --ignore-scripts --no-audit --no-fund

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build


FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci --omit=dev --ignore-scripts --no-audit --no-fund


FROM ${NODE_IMAGE} AS runtime

LABEL org.opencontainers.image.title="devops-task-api" \
      org.opencontainers.image.description="Task REST API for the DevOps CI/CD case" \
      org.opencontainers.image.source="https://github.com/ahsenbulut/devops-task-api"


RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS=--enable-source-maps

WORKDIR /app

COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist


USER 1000:1000

EXPOSE 3000

ENTRYPOINT ["node"]
CMD ["dist/server.js"]

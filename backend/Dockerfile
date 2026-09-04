FROM node:22-alpine AS base

RUN apk add --no-cache python3 make g++

WORKDIR /app

FROM base AS deps

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
RUN npm ci --workspace backend

FROM deps AS builder

COPY backend ./backend

RUN npm run build --workspace backend

FROM base AS development

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY package.json package-lock.json ./
COPY backend ./backend

WORKDIR /app/backend

EXPOSE 5000

CMD ["npm", "run", "start:dev"]

FROM node:22-alpine AS production

RUN apk add --no-cache dumb-init

RUN addgroup -g 1001 -S nestjs && \
    adduser -S nestjs -u 1001

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules

RUN npm prune --omit=dev --workspace backend

COPY --from=builder /app/backend/dist ./backend/dist

RUN chown -R nestjs:nestjs /app

WORKDIR /app/backend

USER nestjs

EXPOSE 5000

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/main"]

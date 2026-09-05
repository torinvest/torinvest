# Dockerfile de l'API USA War Atlas
# Build depuis la racine du monorepo :
#   docker build -f apps/api/Dockerfile -t usa-war-atlas-api .

FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/data/package.json packages/data/
COPY prisma ./prisma
RUN npm install --workspaces --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/data packages/data
COPY apps/api apps/api

RUN npx prisma generate --schema prisma/schema.prisma \
  && npm run build -w @usa-war-atlas/shared \
  && npm run build -w @usa-war-atlas/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./node_modules/@usa-war-atlas/shared/dist
COPY --from=builder /app/packages/shared/package.json ./node_modules/@usa-war-atlas/shared/package.json
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy --schema prisma/schema.prisma && node dist/server.js"]

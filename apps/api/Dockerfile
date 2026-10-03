# Lumi API — build from the repository root: docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @lumi/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @lumi/shared build && pnpm --filter @lumi/api build

FROM node:22-alpine
ENV NODE_ENV=production PORT=4000
WORKDIR /repo
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply pending migrations, then serve.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]

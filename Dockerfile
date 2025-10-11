FROM node:current-alpine AS base

FROM base AS deps
WORKDIR /app
COPY . /app/
RUN npm ci --omit=optional
RUN npx esbuild build.ts --bundle \
    --outfile=build.js --platform=node \
    --format=esm --packages=external
RUN node build.js
RUN npx prisma generate --no-engine

FROM base AS runner
WORKDIR /app/
COPY --from=deps /app/bundle.cjs /app/bundle.cjs
COPY --from=deps /app/node_modules/.prisma/client/*.node /app/
EXPOSE 3000
ENV PORT=3000
CMD [ "node", "bundle.cjs" ]
FROM node:current-alpine AS base

FROM base AS deps
WORKDIR /app
COPY . /app/
RUN npm ci --omit=optional
RUN npm task build:rolldown
RUN npx prisma generate --no-engine

FROM base AS runner
WORKDIR /app/
COPY --from=deps /app/bundle.cjs /app/bundle.cjs
COPY --from=deps /app/node_modules/.prisma/client/*.node /app/
EXPOSE 3000
ENV PORT=3000
CMD [ "node", "bundle.cjs" ]
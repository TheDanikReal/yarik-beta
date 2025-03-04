FROM node:current-alpine AS base

WORKDIR /app
COPY . /app/
RUN npm ci
RUN npx tsc --build
EXPOSE 3000
ENV PORT=3000
CMD [ "node", "api.js" ]
FROM node:22-alpine AS frontend
WORKDIR /app
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS backend
WORKDIR /app
COPY backend/package.json ./
RUN npm install
COPY backend/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY backend/package.json ./
RUN npm install --omit=dev
COPY --from=backend /app/dist ./dist
COPY --from=frontend /app/dist ./public
ENV FRONTEND_DIST=/app/public
ENV DATABASE_PATH=/data/loftet.db
ENV PORT=3000
RUN mkdir -p /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]

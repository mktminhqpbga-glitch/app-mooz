FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node desktop/facebook-pages.cjs desktop/posting-http.cjs /app/desktop/
COPY --chown=node:node services/meta-auth/server.cjs /app/services/meta-auth/server.cjs
USER node
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "services/meta-auth/server.cjs"]

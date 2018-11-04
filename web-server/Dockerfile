FROM node:8.12.0-alpine
RUN addgroup -S chameleon && adduser -S chameleon chameleon
RUN mkdir /opt/web-server  && chown chameleon /opt/web-server
USER chameleon
WORKDIR /opt/web-server
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
ENV  NODE_ENV production
CMD ["node", "server.js"]
FROM node:8.12.0-alpine
RUN addgroup -g 2000 -S chameleon && adduser -S -u 2000 chameleon -G chameleon
RUN mkdir /opt/wamp-api  && chown chameleon /opt/wamp-api
USER chameleon
WORKDIR /opt/wamp-api
COPY package*.json ./
RUN npm install --production
COPY . .
ENV  NODE_ENV production
CMD ["node", "server.js"]
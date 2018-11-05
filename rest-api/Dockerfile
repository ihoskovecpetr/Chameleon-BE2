FROM node:8.12.0-alpine
RUN addgroup -S chameleon && adduser -S chameleon chameleon
RUN mkdir /opt/rest-api  && chown chameleon /opt/rest-api
USER chameleon
WORKDIR /opt/rest-api
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
ENV  NODE_ENV production
CMD ["node", "server.js"]
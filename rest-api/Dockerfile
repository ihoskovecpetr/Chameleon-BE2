FROM node:10.14-alpine
RUN addgroup -g 2000 -S chameleon && adduser -S -u 2000 chameleon -G chameleon
RUN mkdir /opt/app
WORKDIR /opt/app
COPY . .
#RUN apk --no-cache --virtual build-dependencies add \
#    python \
#    make \
#    g++ \
#    && npm install --production \
#    && apk del build-dependencies \
#    && chown -R chameleon: /opt/app
RUN  npm install --production && chown -R chameleon: /opt/app
USER chameleon
EXPOSE 3000
CMD ["node", "server.js"]
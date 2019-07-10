FROM crossbario/crossbar
USER root
RUN mkdir -p  /crossbar-node/.crossbar
COPY ./crossbar-node/config.json /crossbar-node/.crossbar/config.json
RUN chown -R crossbar:crossbar /crossbar-node
EXPOSE 3000
ENTRYPOINT ["crossbar", "start","--logformat", "standard", "--loglevel", "warn", "--cbdir", "/crossbar-node/.crossbar"]
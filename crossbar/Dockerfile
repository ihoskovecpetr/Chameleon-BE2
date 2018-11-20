FROM crossbario/crossbar
USER root
COPY ./crossbar-node /crossbar-node
RUN chown -R crossbar:crossbar /crossbar-node
EXPOSE 9000
ENTRYPOINT ["crossbar", "start", "--cbdir", "/crossbar-node/.crossbar"]
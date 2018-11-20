#!/usr/bin/env bash
docker run --rm -it -p 24224:24224 -p 24224:24224/udp -v ~/Development/chameleon-backend/logs:/fluentd/log chameleon/fluentd:latest
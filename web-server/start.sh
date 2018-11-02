#!/usr/bin/env bash
docker run --rm -it -p 3000:3000 --name web-server -v ~/Development/chameleon-backend/web-server/logs:/opt/web-server/logs chameleon/web-server
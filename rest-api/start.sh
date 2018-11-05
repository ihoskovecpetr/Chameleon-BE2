#!/usr/bin/env bash
docker run --rm -it --init -p 3001:3000 -e NODE_ENV=development -e HOST_PORT=3002 --name rest-api -v ~/Development/chameleon-backend/logs:/opt/rest-api/logs chameleon/rest-api
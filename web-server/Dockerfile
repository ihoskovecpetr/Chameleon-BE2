FROM node:8.12.0-alpine
WORKDIR /opt/web-server
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
FROM node:20-alpine

WORKDIR /usr/src/app

# Install dependencies needed for native builds and networking tools
RUN apk add --no-cache python3 make g++ wget curl

# Copiamos package.json primero
COPY package*.json ./

RUN npm install

# Copiamos el resto del código
COPY . .

# Healthcheck to verify node is responding on the required port
HEALTHCHECK --interval=5s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

EXPOSE 3000

CMD ["npm", "run", "start:dev"]

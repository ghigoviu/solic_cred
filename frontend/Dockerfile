FROM node:20-alpine

WORKDIR /usr/src/app

# Instalación de curl para healthcheck
RUN apk add --no-cache curl

# Copiamos dependencias
COPY package*.json ./

# Evitamos que falle si el package.json de vite no se ha generado aún localmente
RUN if [ -f package.json ]; then npm install; else echo "Esperando setup del frontend..." > init.log; fi

COPY . .

HEALTHCHECK --interval=5s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5173/ || exit 1

EXPOSE 5173

CMD ["npm", "run", "dev"]

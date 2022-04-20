FROM node:alpine
WORKDIR /app
EXPOSE 3000
RUN npm install -g serve

COPY package.json ./
COPY package-lock.json ./
COPY ./ ./
RUN npm i
RUN npm run build
CMD ["serve", "-s", "build"]

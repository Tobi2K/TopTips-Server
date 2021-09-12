FROM node:14

ENV APP_PORT 3000

EXPOSE 3000

WORKDIR /usr/src/app

RUN npm i typescript -g --loglevel notice
RUN npm i @nestjs/cli -g --loglevel notice

COPY package.json .
COPY . .

RUN npm install --loglevel notice --unsafe-perm

RUN npm run build

CMD [ "npm", "run", "start:prod" ]
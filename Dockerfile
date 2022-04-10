FROM node:14

ENV APP_PORT 3000

ENV API_KEY=$API_KEY 
ENV FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID 
ENV FIREBASE_PRIVATE_KEY=$FIREBASE_PRIVATE_KEY 
ENV FIREBASE_CLIENT_EMAIL=$FIREBASE_CLIENT_EMAIL

ENV TZ=Europe/Berlin

EXPOSE 3000

WORKDIR /usr/src/app

RUN npm i typescript -g --loglevel notice
RUN npm i @nestjs/cli -g --loglevel notice

COPY package.json .
COPY . .

RUN npm install --loglevel notice --unsafe-perm

RUN npm run build

CMD [ "npm", "run", "start:prod" ]
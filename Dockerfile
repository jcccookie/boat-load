FROM node:15
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
ENV PORT=8000
EXPOSE ${PORT}
ENV GOOGLE_APPLICATION_CREDENTIALS='./boat-load-311606-2267df08abde.json'
CMD [ "npm", "start" ]
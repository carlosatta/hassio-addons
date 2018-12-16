ARG BUILD_FROM
FROM $BUILD_FROM

WORKDIR /usr/src/hassio_meross

USER root
ENV LANG C.UTF-8
RUN apk add --no-cache nodejs nodejs-npm 
    
COPY package*.json ./

RUN npm install

COPY run.sh /

COPY . .

CMD [ "/run.sh" ]

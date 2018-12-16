ARG BUILD_FROM
FROM $BUILD_FROM

USER root
ENV LANG C.UTF-8
RUN apk add --no-cache nodejs nodejs-npm

WORKDIR /usr/src/hassio_meross
    
COPY package*.json ./

RUN npm install

COPY . .

COPY run.sh /

CMD [ "/run.sh" ]

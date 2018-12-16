ARG BUILD_FROM
FROM $BUILD_FROM

USER root
ENV LANG C.UTF-8
RUN apk add --no-cache nodejs nodejs-npm

WORKDIR /data
    
COPY package*.json ./

RUN npm install

COPY . .
RUN chmod a+x /data/run.sh

CMD [ "/data/run.sh" ]

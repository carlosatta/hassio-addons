const mqttClient = require('mqtt');
const q = require('q');

function mqtt(config = undefined) {

  if (config || !this.config) {
    this.config = config;
  }
    
  if(!this.config.username || !this.config.username.length) {
    delete this.config.username;
  }

  if(!this.config.password || !this.config.password.length) {
    delete this.config.password;
  }

  if (!this.client) {
    this.config.clean = true;
    this.client  = mqttClient.connect(this.config);

    this.client.on('connect', () => {
      console.log('[MQTT] Connect to the broker.');
    });

    this.client.on('reconnect', () => {
      console.log('[MQTT] Try to reconnect.');
    });

    this.client.on('close', () => {
      console.log('[MQTT] Connection closed.');
    });

    this.client.on('offline', () => {
      console.log('[MQTT] Server offline.');
    });

    this.client.on('error', (error) => {
      console.error('[MQTT] Error!.');
      console.log(error);
    });

    this.client.on('end', () => {
      console.log('[MQTT] Connection ended.');
    });

    this.client.on('message', (topic, message) => {
      // console.log(`[MQTT] message on topic ${topic}.`);
    });
    
  }

  this.publish = (topic, message, options = {}) => {
    const deferred = q.defer();

    if (message) {
      message = JSON.stringify(message);
    }
    
    this.client.publish(topic, message, options, (error) => {
      if (error) {
        deferred.reject(new Error(error));
      } else {
        deferred.resolve();
      }
    });
    return deferred.promise;
  }
  
  
  return this;

}

module.exports = mqtt;
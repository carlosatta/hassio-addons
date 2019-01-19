const options = require('../../options.json');
const mqtt = require('../mqtt')();


class Channel {
  constructor(id, device, { type = 'Switch', devName }) {
    this.id = id;
    this.type = type;
    this.name = devName ? `${devName}` : device.name;
    this.device = device;

    this.mqtt = {
      baseTopic: 'undefined',
      pattern: `${this.baseTopic}/+action`,
      discovery_prefix: options.topic.discovery_prefix,
    }    
  }

  sendConfig(config) {
    return this.send({
      context: 'config',
      message: config,
      retain: true,
    })
      .then(() => {
        console.log(`    [${this.type}][${this.name}] Config send.`);
      })
      .catch((error) => {
        console.error(error);
      });
  }

  messageState(state) {
    return {
      name: this.name,
      state: state,
      device: this.device.getInfo(),
    };
  }

  sendState(state) {
    return this.send({
      context: 'state',
      message: this.messageState(state),
      retain: true,
    }).then(() => {
      console.log(`    [${this.type}][${this.name}] State send.`);
    })
    .catch((error) => {
      console.error(error);
    });
  }

  async listen() {
    mqtt.client.subscribe(`${this.mqtt.baseTopic}/#`, (error) => {
      console.log(`    [${this.type}][${this.name}] Listening on base topic ${this.mqtt.baseTopic}/.`);
    });
    this.manageMessage();
  }

  manageMessage() {
    // WUT?!
  }

  send({context, message, qos = 0, retain = false}) {
    const topic = `${this.mqtt.baseTopic}/${context}`;
    return mqtt.publish(
      topic,
      message,
      {qos, retain}
    )
      .then(() => {
        console.log(`    [${this.type}][${this.name}] Message send to ${topic}.`);
      })
      .catch((error) => {
        console.error(`    [${this.type}][${this.name}] Error sending message to ${context}.`);
        console.error(error);
      });
  }
  
}

module.exports = Channel;
  
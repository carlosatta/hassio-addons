const q = require('q');

const Channel = require('./channel');
const mqtt = require('../mqtt')();
const mqtt_regex = require("mqtt-regex");

class Switch extends Channel{
  constructor(...args) {
    super(...args);
    this.__state;
    this.mqtt.baseTopic = `${this.mqtt.discovery_prefix}/switch/${this.device.uuid}_${this.id}`;
    this.mqtt.pattern = `${this.mqtt.baseTopic}/+action`;
    this.bootstrap();
  }

  get config() {
    return {
      name: this.name,
      command_topic:      `${this.mqtt.baseTopic}/command`,
      state_topic:        `${this.mqtt.baseTopic}/state`,
      value_template:     '{{value_json.state}}',
      payload_on:         "1",
      payload_off:        "0",
      state_on:           "1",
      state_off:          "0",
      unique_id:          `${this.device.uuid}_${this.id}`,
      device:             this.device.getInfo()
    };
  }

  set state(value) {
    this.__state = value;
    this.sendState(this.state);
  }

  get state() {
    return this.__state;
  }

  async command(state) {
    try {
      await this.controlToggle(state)
      this.state = state;
    } catch (error) {
      console.error(`[ERROR][${this.type}][${this.name}] Error in command: ${error.message}.`);
    }
  }

  async bootstrap() {
    console.log(`    [${this.type}][${this.name}] Preparation.`);

    await mqtt.publish(`${this.mqtt.baseTopic}/command`, '');
    await mqtt.publish(`${this.mqtt.baseTopic}/state`, '');

    try {
      let info = await this.getSystemAllData();
      this.state = info.all.digest.togglex[this.id].onoff;
    } catch (error) {
      console.warn(`[WARN][${this.type}][${this.name}] Impossibile retrieve real status: ${error.message}.`);
      this.state = 0;
    }

    await this.sendConfig(this.config);
    await this.listen();
  }

  manageMessage() {
    mqtt.client.on('message', (topic, message) => {
      const room_message_info = mqtt_regex(this.mqtt.pattern).exec;
      const params = room_message_info(topic);

      if (!params || !params.action) {
        return;
      }

      try {
        console.log(`    [${this.type}][${this.name}] Message arrived to ${topic}.`);
        message = JSON.parse(message);
        switch (params.action) {
          case 'command':
            this.command(message);
            break;
          
            default:
              // console.debug(`[DEBUG][${this.type}][${this.name}] Ignored action "${params.action}" called.`);
              break;
        }
      } catch (error) {
        console.error(`    [${this.type}][${this.name}] ${error.message}.`)
      }

      
    });
  }

  getSystemAllData() {
    const deferred = q.defer();
    this.device.meross.getSystemAllData((error, response) => {
      if (error) {
        deferred.reject(error);
      }
      deferred.resolve(response);
    });
    return deferred.promise;
  }

  controlToggle(state) {
    const deferred = q.defer();
    this.device.meross.controlToggleX(this.id, state, (error, response) => {
      if (error) {
        deferred.reject(error);
      }
      deferred.resolve(response);
    });
    return deferred.promise;  
  }

}

module.exports = Switch;
  
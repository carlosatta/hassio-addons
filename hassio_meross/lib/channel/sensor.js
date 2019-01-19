const q = require('q');

const mqtt = require('../mqtt')();
const options = require('../../options.json');
const Channel = require('./channel');

class Sensor extends Channel{
  constructor(...args) {
    super(...args);
    this.__state;    
    this.type = 'Sensor';
    this.ability = args.pop();
    this.name = `${this.name} - ${this.type} ${this.ability}`;
    this.mqtt.baseTopic = `${this.mqtt.discovery_prefix}/sensor/${this.device.uuid}_${this.id}_${this.ability}`;
    this.bootstrap();
  }

  async bootstrap() {
    console.log(`    [${this.type}][${this.name}] Preparation.`);
    try {
      await mqtt.publish(`${this.mqtt.baseTopic}/state`, '');
      await this.sendConfig(this.config);
      this.watchState();
    } catch (error) {
      console.error(`[ERROR][${this.type}][${this.name}] Error in bootstrap: ${error.message}.`);
      console.error(error);
      return;
    }
  }

  set state(value) {
    this.__state = value;
    this.sendState(this.state);
  }

  get state() {
    return this.__state;
  }

  async watchState() {

    switch (this.ability) {
        case 'current':
          const consumption = await this.getControlPowerConsumptionX();
          this.state = consumption.consumptionx.pop().value;
          break;
      
        default:
          const electricity = await this.getControlElectricity();
          const value = electricity.electricity[this.ability] ? electricity.electricity[this.ability] : 0;
          this.state = value;
          break;
      }

    setTimeout(async () => {
      await this.watchState();
    }, options.devices.refresh);
  }

  get config() {
    return {
      name: this.name,
      state_topic:        `${this.mqtt.baseTopic}/state`,
      value_template:       typeToSymbol(this.ability).template,
      unit_of_measurement: typeToSymbol(this.ability).unit,
      unique_id:          `${this.device.uuid}_${this.id}_${this.ability}`,
      device:             this.device.getInfo()
    };
  }

  messageState(state) {
    return {
      name: this.name,
      state: state.toString(),
      device: this.device.getInfo(),
    };
  }

  async getControlPowerConsumptionX() {
    const deferred = q.defer();
    this.device.meross.getControlPowerConsumptionX((error, response) => {
      if (error) {
        deferred.reject(error);
      }
      deferred.resolve(response);
    });
    return deferred.promise;
  }

  async getControlElectricity() {
    const deferred = q.defer();
    this.device.meross.getControlElectricity((error, response) => {
      if (error) {
        deferred.reject(error);
      }
      deferred.resolve(response);
    });
    return deferred.promise;
  }
  
}

module.exports = Sensor;

function typeToSymbol (type) {
  switch (type) {
    case 'power':
      return {
        unit: 'W',
        template: '{{ value_json.state | float / 1000}}',
      };
      break;
  
    case 'current' :
      return {
        unit: 'A',
        template: '{{ value_json.state | float / 1000}}',
      };
      break;

    case 'voltage' :
      return {
        unit: 'V',
        template: `{{value_json.state | float / 10}}`,
      };
      break;

    case 'consumption' :
      return {
        unit: 'kWh',
        template: '{{ value_json.state | float / 1000}}',
      };
      break;
  }
}
  
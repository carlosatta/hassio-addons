'use strict';

const util = require('util');
const q = require('q');
const JSON = require('circular-json');

const MerossCloud = require('meross-cloud');
const mqtt = require('mqtt')
const mqtt_regex = require("mqtt-regex");

const options = require('./options.json');


// MQTT
if(!options.mqtt.username || !options.mqtt.username.length) {
  delete options.mqtt.username;
}

if(!options.mqtt.password || !options.mqtt.password.length) {
  delete options.mqtt.password;
}

const client  = mqtt.connect(options.mqtt);

client.on('message', function (topic, message) {

  message = message.toString();
  message = JSON.parse(message);

  var topicReg = mqtt_regex('+prefix/+type/+elements/+action').exec;
  var params = topicReg(topic);
  let elements = params.elements.split('_');
  params.id = elements[0];
  params.channel = elements[1]; 
  
  switch(params.action) {
    case 'config':
      console.debug(`Device ${params.id} configured ${JSON.stringify(message)}.`);
      break;
    case 'command':
      console.debug(`Device ${params.id} recive a command ${JSON.stringify(message)}.`);
      setSwitchStatus(params.id, params.channel, booleanStatus(message));
      break;

    case 'state':
      console.debug(`Device ${params.id} change status ${JSON.stringify(message)}.`);
      break;

    default:
      console.warn(`Device ${params.id} send a unknow message ${JSON.stringify(message)}.`);
      break;
  }
  
});

// MEROSS
const meross = new MerossCloud(options.meross);

meross.connect((error) => {
  if(error) {
    console.error(error);
    process.exit(1);
  }
})

meross.on('connected', (uuid) => {
  let device = meross.getDevice(uuid);
  console.log(`Device ${device.dev.devName} (${device.dev.deviceType}) (${uuid}) discovered.`);
});

meross.on('error', (uuid, error) => {
  console.error(`Error from the device ${uuid}.`);
  console.error(error);
});

meross.on('close', (uuid, error) => {
  console.error(`Connection close from the device ${uuid}.`);
  console.error(error);
});

meross.on('reconnect', (uuid) => {
  console.error(`Reconnection from the device ${uuid}.`);
});

meross.on('deviceInitialized', (uuid, deviceDef, device) => {
    device.on('connected', () => {
      manageDevice(deviceDef, device)
    });

    device.on('data', (namespace, payload) => {
      switch (namespace) {
        case 'Appliance.Control.ToggleX':
          sendSwitchStatus(uuid, payload);   
          break;
      
        default:
          console.warn(`Unsupported ability ${namespace} for the divice ${uuid}.`);
          console.debug(payload);
          break;
      }      
    });

});

// Generic 
function manageDevice(definition, device = null) {  
  for (let channel in definition.channels) {
    let name = definition.channels[channel].devName ? `${definition.channels[channel].devName}` : `${definition.devName}`;
    let config = createSwitchConfig(name, definition.uuid, channel);
    manageSubscriptionSwitchDevice(definition.uuid, channel, config);

    if (device) {    
      device.getSystemAllData((err, info) => {
        if(err || !info || !info.all || !info.all.digest) return;
        sendSwitchStatus(definition.uuid, info.all.digest);
      });
    }


    device.getSystemAbilities((err, info) => {

      if(err || !info || !info.ability) return;
      
      if (info.ability['Appliance.Control.ConsumptionX']) {
        let config = createSensorConfig(name, definition.uuid, channel, 'consumption');
        manageSubscriptionSensorDevice(definition.uuid, 'consumption', config);
      }

      if (info.ability['Appliance.Control.Electricity']) {
        device.getControlElectricity((err, info) => {  
          if(err || !info || !info.electricity) return;

          for (let type in info.electricity) {
            if (type === 'channel') {
              continue;
            }
            let config = createSensorConfig(name, definition.uuid, channel, type);
            manageSubscriptionSensorDevice(definition.uuid, type, config);
          }
        });
      }

      if (info.ability['Appliance.Control.ConsumptionX'] || info.ability['Appliance.Control.Electricity']) {
        sendSensorData(definition.uuid, channel);
      }

    });
  }
}


// Switch
function createSwitchConfig(name, uuid, channel) {
  return {
    name: name,
    command_topic:      `${options.topic.discovery_prefix}/switch/${uuid}_${channel}/command`,
    state_topic:        `${options.topic.discovery_prefix}/switch/${uuid}_${channel}/state`,
    value_template:     '{{value_json.state}}',
    payload_on:         "1",
    payload_off:        "0",
    state_on:           "1",
    state_off:          "0",
    unique_id:          `${uuid}_${channel}`,
    device:             getDeviceInfo(uuid),
    retain:             true
  };
}

function manageSubscriptionSwitchDevice(uuid, channel, config) {
  client.publish(`${options.topic.discovery_prefix}/switch/${uuid}_${channel}/config`, JSON.stringify(config), {
    qos: 2,
    retain: true
  });

  client.subscribe(`${options.topic.discovery_prefix}/switch/${uuid}_${channel}/config`, function (err) {
    // console.error(err)
  })

  client.subscribe(`${config.command_topic}`, function (err) {
    // console.error(err)
  })

  client.subscribe(`${config.state_topic}`, function (err) {
    // console.error(err)
  })
}

function sendSwitchStatus(uuid, status) {
  if (!status || !status.togglex) return;

  if (!Array.isArray(status.togglex)) {
    status.togglex = [status.togglex];
  }

  for (let info of status.togglex) {
    client.publish(`${options.topic.discovery_prefix}/switch/${uuid}_${info.channel}/state`, JSON.stringify({
      state: info.onoff,
      device: getDeviceInfo(uuid)
    }), {});
  }
}

function setSwitchStatus(uuid, channel, state) {
  let device = meross.getDevice(uuid);
  device.controlToggleX(channel, state);
}


// Sensor
function createSensorConfig(name, uuid, channel, type) {
  return {
    name:                 `${name} - ${type}`,
    state_topic:          `${options.topic.discovery_prefix}/sensor/${uuid}_${channel}/state`,
    value_template:       typeToSymbol(type).template,
    unit_of_measurement:  typeToSymbol(type).unit,
    unique_id:            `${uuid}_${channel}_${type}`,
    device:               getDeviceInfo(uuid)
  };
}

function manageSubscriptionSensorDevice(uuid, type, config) {
  client.publish(`${options.topic.discovery_prefix}/sensor/${uuid}_${type}/config`, JSON.stringify(config), {
    qos: 2,
    retain: true
  });
}

function sendSensorData(uuid, channel) {
  let sensor_data = {};

  let device = meross.getDevice(uuid);

  return q.fcall(() => {
    var deferred = q.defer();
    device.getSystemAbilities((err, abilities) => {
      if (err) return deferred.resolve(err);
      return deferred.resolve(abilities);
    });
    return deferred.promise;
  })
    .then((abilities) => {
      return [
        (() => {
          var deferred = q.defer();
          if (abilities.ability['Appliance.Control.ConsumptionX']) {            
            device.getControlPowerConsumptionX((err, consumption) => {
              if (err) return deferred.resolve(err);
              return deferred.resolve(consumption);
            });
            return deferred.promise;
          }
          return null;
        })(),
        (() => {
          var deferred = q.defer();
          if (abilities.ability['Appliance.Control.ConsumptionX']) {            
            device.getControlElectricity((err, electricity) => {
              if (err) return deferred.resolve(err);
              return deferred.resolve(electricity);
            });
            return deferred.promise;
          }
          return null;
        })(),
      ];
    })
    .spread((consumption, electricity) => {
      if (consumption && consumption.consumptionx) {
        sensor_data.consumption = consumption.consumptionx.pop().value;
      }

      if (electricity && electricity.electricity) {
        for (let type in electricity.electricity) {
          if (type === 'channel') {
            continue;
          }
          sensor_data[type] = electricity.electricity[type];          
        }
      }
      return;
    })
    .then(() => {
      sensor_data.device = getDeviceInfo(uuid);
      client.publish(`${options.topic.discovery_prefix}/sensor/${uuid}_${channel}/state`, JSON.stringify(sensor_data), {
        qos: 1
      });
    })
    .then(() => {
      setTimeout(() => {
        sendSensorData(uuid, channel);
      }, options.devices.refresh);
    })
    .catch((error) => {
      console.error('Impossible to retrieve sensor data.');
      console.error(error);
    })    
}

// Tool

function getDeviceInfo(uuid) {
  let device = meross.getDevice(uuid);
  return {
    name: device.dev.devName,
    model: device.dev.deviceType,
    sw_version: device.dev.fmwareVersion,
    identifiers: [
      device.dev.uuid
    ]
  }
}

function typeToSymbol (type) {
  switch (type) {
    case 'power':
      return {
        unit: 'W',
        template: `{{ value_json.${type} | float / 1000}}`,
      };
      break;
  
    case 'current' :
      return {
        unit: 'A',
        template: `{{ value_json.${type} | float / 1000}}`,
      };
      break;

    case 'voltage' :
      return {
        unit: 'V',
        template: `{{value_json.${type} | float / 10}}`,
      };
      break;

    case 'consumption' :
      return {
        unit: 'kWh',
        template: `{{ value_json.${type} | float / 1000}}`,
      };
      break;
  }
}

function booleanStatus(string) {
  return [ 
    1,
    '1',
    true,
    'true',
    'True',
    'TRUE',
    'yes',
    'Yes',
    'YES',
    'on',
    'On',
    'ON'
  ].includes(string);
}
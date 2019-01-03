'use strict';

const MerossCloud = require('meross-cloud');
const mqtt = require('mqtt')
const mqtt_regex = require("mqtt-regex");

const options = require('./options.json');

if(!options.mqtt.username || !options.mqtt.username.length) {
  delete options.mqtt.username;
}

if(!options.mqtt.password || !options.mqtt.password.length) {
  delete options.mqtt.password;
}


const client  = mqtt.connect(options.mqtt)
const meross = new MerossCloud(options.meross);

meross.connect((error) => {
  if(error) {
    console.error(error);
    process.exit(1);
  }
})

meross.on('connected', (deviceId) => {
  console.log(`Connected to the device ${deviceId}.`);
});

meross.on('error', (deviceId, error) => {
  console.error(`Error from the device ${deviceId}.`);
  console.error(error);
});

meross.on('close', (deviceId, error) => {
  console.error(`Connection close from the device ${deviceId}.`);
  console.error(error);
});

meross.on('reconnect', (deviceId) => {
  console.error(`Reconnection from the device ${deviceId}.`);
});

meross.on('deviceInitialized', (deviceId, deviceDef, device) => {
    device.on('connected', () => {
      manageDevice(deviceDef, device)
    });

    device.on('data', (namespace, payload) => {
      switch (namespace) {
        case 'Appliance.Control.ToggleX':
          sendSwitchStatus(deviceId, payload);   
          break;
      
        default:
          console.warn(`Unsupported ability ${namespace} for the divice ${deviceId}.`);
          console.debug(payload);
          break;
      }      
    });

});


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

function manageDevice(definition, device = null) {  
  for (let channel in definition.channels) {
    // let name = definition.channels[channel].devName ? `${definition.devName} - ${definition.channels[channel].devName}` : `${definition.devName}`;
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
        device.getControlPowerConsumptionX((err, info) => {
          let config = createSensorConfig(name, definition.uuid, 'consumption');
          manageSubscriptionSensorDevice(definition.uuid, 'consumption', config);
          sendSensorConsumption(definition.uuid, info);
        });

        setInterval(() => {
          device.getControlPowerConsumptionX((err, info) => {
            sendSensorConsumption(definition.uuid, info);
          });
        }, options.devices.refresh);
      }


      if (info.ability['Appliance.Control.Electricity']) {
        device.getControlElectricity((err, info) => {
          if(err || !info || !info.electricity || !info.electricity.length) return;

          for (let type in info.electricity) {
            if (type === 'channel') {
              continue;
            }
            let config = createSensorConfig(name, definition.uuid, type);
            manageSubscriptionSensorDevice(definition.uuid, type, config);
            sendSensorEletricity(definition.uuid, info);
          }
        });
      }

      setInterval(() => {
        device.getControlElectricity((err, info) => {
          sendSensorEletricity(definition.uuid, info);
        });
      }, options.devices.refresh);

    });
  }
}

function manageSubscriptionSwitchDevice(uuid, channel, config) {
  client.publish(`${options.topic.discovery_prefix}/switch/${uuid}_${channel}/config`, JSON.stringify(config), {
    qos: 2
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

function sendSwitchStatus(id, status) {
  if (!status || !status.togglex) return;

  if (!Array.isArray(status.togglex)) {
    status.togglex = [status.togglex];
  }

  for (let info of status.togglex) {
    client.publish(`${options.topic.discovery_prefix}/switch/${id}_${info.channel}/state`, JSON.stringify({
      state: info.onoff
    }), {
      qos: 2
    });
  }
}

function setSwitchStatus(id, channel, state) {
  let device = meross.getDevice(id);
  device.controlToggleX(channel, state);
}

function createSwitchConfig(name, uuid, channel) {
  return {
    name: name,
    command_topic:      `${options.topic.discovery_prefix}/switch/${uuid}_${channel}/command`,
    state_topic:        `${options.topic.discovery_prefix}/switch/${uuid}_${channel}/state`,
    value_template:     '{{value_json.state}}',
    payload_on:         1,
    payload_off:        0,
    state_on:           1,
    state_off:          0,
    // availability_topic: `${options.topic.discovery_prefix}/switch/${uuid}_${channel}/status`,
    // payload_available:  'Online',
    // payload_not_available:  'Offline'
  };
}



function createSensorConfig(name, uuid, type) {
  return {
    name: `${name} - ${type}`,
    state_topic:        `${options.topic.discovery_prefix}/sensor/${uuid}_${type}/state`,
    value_template:     typeToSymbol(type).template,
    unit_of_measurement: typeToSymbol(type).unit,
    // availability_topic: `${options.topic.discovery_prefix}/${uuid}_${type}/status`,
    // payload_available:  'Online',
    // payload_not_available:  'Offline'
  };
}

function manageSubscriptionSensorDevice(uuid, type, config) {
  client.publish(`${options.topic.discovery_prefix}/sensor/${uuid}_${type}/config`, JSON.stringify(config), {
    qos: 
  });
}

function sendSensorEletricity(uuid, state) {
  if (!state || !state.electricity) return;

  for (let type in state.electricity) {
    if (type === 'channel') {
      continue;
    }

    client.publish(`${options.topic.discovery_prefix}/sensor/${uuid}_${type}/state`, JSON.stringify({
      value: state.electricity[type]
    }), {
      qos: 2
    });
  }
}

function sendSensorConsumption(uuid, state) {
  if (!state || !state.consumptionx ||!state.consumptionx.length) return;

  let consumption = state.consumptionx.pop()
  
  client.publish(`${options.topic.discovery_prefix}/sensor/${uuid}_consumption/state`, JSON.stringify({
    value: consumption.value
  }), {
    qos: 
  });
}



function typeToSymbol (type) {
  switch (type) {
    case 'power':
      return {
        unit: 'W',
        template: '{{value_json.value | float / 1000 }}',
      };
      break;
  
    case 'current' :
      return {
        unit: 'A',
        template: '{{value_json.value | float / 1000 }}',
      };
      break;

    case 'voltage' :
      return {
        unit: 'V',
        template: '{{value_json.value | float / 1000 }}',
      };
      break;

    case 'consumption' :
      return {
        unit: 'kWh',
        template: '{{value_json.value | float / 1000 }}',
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
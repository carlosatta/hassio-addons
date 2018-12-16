'use strict';

const MerossCloud = require('meross-cloud');
const mqtt = require('mqtt')
const mqtt_regex = require("mqtt-regex");

const options = require('./options.json');

const client  = mqtt.connect(options.mqtt)
const meross = new MerossCloud(options.meross);

meross.connect((error) => {
  if(error) {
    console.error(error);
    process.exit(1);
  }
})

meross.on('connected', (deviceId) => {
  // console.log(`Connected to the device ${deviceId}.`);
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
      manageDevice(deviceDef)
    });

    device.on('data', (namespace, payload) => {
      sendSwitchStatus(deviceId);
    });

});

client.on('message', function (topic, message) {
  var topicReg = mqtt_regex('+prefix/+type/+id/+action').exec;
  var params = topicReg(topic); 
  
  switch(params.action) {
    case 'config':
      console.debug(`Device ${params.id} configured ${message.toString()}.`);
      break;
    case 'command':
    console.debug(`Device ${params.id} recive a command ${message.toString()}.`);
      setSwitchStatus(params.id, booleanStatus(message.toString()));
      break;

    case 'state':
      console.debug(`Device ${params.id} chenge status ${message.toString()}.`);
      break;

    default:
      console.warn(`Device ${params.id} recive a unknow message ${message.toString()}.`);
      break;
  }
  
});

function manageDevice(definition) {
  // console.log(definition)
  let config = setSwitchConfig(definition);
  client.publish(`${options.topic.discovery_prefix}/switch/${definition.uuid}/config`, JSON.stringify(config), {
    qos: 2,
    retain: true
  });

  client.subscribe(`${options.topic.discovery_prefix}/switch/${definition.uuid}/config`, function (err) {
    // console.error(err)
  })

  client.subscribe(`${config.command_topic}`, function (err) {
    // console.error(err)
  })

  client.subscribe(`${config.state_topic}`, function (err) {
    // console.error(err)
  })

}

function sendSensorData() {}

function sendSwitchStatus(id) {
  let device = meross.getDevice(id);
  device.getSystemAllData((err, data) => {
    for(let channel of data.all.digest.togglex) {
      // console.log(channel);
      client.publish(`${options.topic.discovery_prefix}/switch/${id}/state`, JSON.stringify({
        state: channel.onoff
      }), {
        qos: 2,
        retain: true
      });
    }
  });
}

function setSwitchStatus(id, state) {
  console.log(id, state);
  let device = meross.getDevice(id);
  device.controlToggleX(0, state);
}

function setSwitchConfig(definition) {
  return {
    name: definition.devName,
    command_topic:      `${options.topic.discovery_prefix}/switch/${definition.uuid}/command`,
    state_topic:        `${options.topic.discovery_prefix}/switch/${definition.uuid}/state`,
    // availability_topic: `${options.topic.discovery_prefix}/switch/${definition.uuid}/status`,
    value_template:     '{{value_json.state}}',
    payload_on:         1,
    payload_off:        0,
    state_on:           1,
    state_off:          0,
    // payload_available:  'Online',
    // payload_not_available:  'Offline'
  };
}

function booleanStatus(string) {
  return [ 
    1,
    true,
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
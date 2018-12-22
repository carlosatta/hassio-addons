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
      // console.log('Data', deviceId, namespace, payload);
      
      switch (namespace) {
        case 'Appliance.Control.ToggleX':
          sendSwitchStatus(deviceId, payload);   
          break;
      
        default:
          console.log(deviceId, namespace, payload);
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
      // console.debug(`Device ${params.id} configured ${JSON.stringify(message)}.`);
      break;
    case 'command':
      // console.debug(`Device ${params.id} recive a command ${JSON.stringify(message)}.`);
      setSwitchStatus(params.id, params.channel, booleanStatus(message));
      break;

    case 'state':
      // console.debug(`Device ${params.id} change status ${JSON.stringify(message)}.`);
      break;

    default:
      // console.warn(`Device ${params.id} recive a unknow message ${JSON.stringify(message)}.`);
      break;
  }
  
});

function manageDevice(definition, device = null) {  
  for (let channel in definition.channels) {
    let name = definition.channels[channel].devName ? `${definition.devName} - ${definition.channels[channel].devName}` : `${definition.devName}`;
    let config = setSwitchConfig(name, definition.uuid, channel);
    manageSubscriptionDevice(definition.uuid, channel, config)
  }

  if (device) {    
    device.getSystemAllData((err, info) => {
      sendSwitchStatus(definition.uuid, info.all.digest);
    });
  }
  
  
}

function manageSubscriptionDevice(uuid, channel, config) {
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

function sendSensorData() {}

function sendSwitchStatus(id, status) {
  for (let info of status.togglex) {
    client.publish(`${options.topic.discovery_prefix}/switch/${id}_${info.channel}/state`, JSON.stringify({
      state: info.onoff
    }), {
      qos: 2,
      retain: true
    });
  }
}

function setSwitchStatus(id, channel, state) {
  let device = meross.getDevice(id);
  device.controlToggleX(channel, state);
}

function setSwitchConfig(name, uuid, channel) {
  return {
    name: name,
    command_topic:      `${options.topic.discovery_prefix}/switch/${uuid}_${channel}/command`,
    state_topic:        `${options.topic.discovery_prefix}/switch/${uuid}_${channel}/state`,
    // availability_topic: `${options.topic.discovery_prefix}/switch/${uuid}_${channel}/status`,
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
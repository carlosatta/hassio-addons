const MerossCloud = require('meross-cloud');

const Device = require('./device');

class Meross {
  constructor(config) {
    this.meross = new MerossCloud(config);
    this.meross.setMaxListeners(0);
    this.devices = {};
    
    this.meross.connect((error) => {
      if (error) {        
        this.connectionError(error);
      }
    });

    this.meross.on('connected', (uuid) => {
      this.connected(uuid);
    });

    this.meross.on('deviceInitialized', (uuid, deviceDef, device) => {
      this.deviceInitialized(uuid, device);
    });

    this.meross.on('error', (uuid, error) => {
      console.error(`Error from the device ${uuid}.`);
      console.error(error);
    });

    this.meross.on('close', (uuid, error) => {
      console.error(`Connection close from the device ${uuid}.`);
      console.error(error);
    });

    this.meross.on('reconnect', (uuid) => {
      console.error(`Reconnection from the device ${uuid}.`);
    });

    return this;
  }

  connected(uuid) {}

  connectionError(error) {
    if(error) {
      console.error(error);
      // process.exit(1);
    }
  }

  deviceInitialized(uuid, device) {
    console.log(`Initizializing the device ${uuid}.`);
    this.devices[uuid] = new Device(device);
  }
}

module.exports = Meross;
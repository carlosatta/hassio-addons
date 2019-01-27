const Switch = require('./channel/switch');
const Sensor = require('./channel/sensor');

class Device {
  constructor(device) {
    this.meross = device;
    this.uuid = this.meross.dev.uuid;
    this.name = this.meross.dev.devName;
    this.deviceType = this.meross.dev.deviceType;
    this.fmwareVersion = this.meross.dev.fmwareVersion;
    this.hdwareVersion = this.meross.dev.hdwareVersion;

    this.switchs = [];
    this.sensors = [];    

    this.meross.on('connected', () => {
      this.connected();
    });

    this.meross.on('data', (namespace, payload) => {
      switch (namespace) {
        case 'Appliance.Control.Toggle':
          console.log(error);
          console.log('DEVICE ----------', this.name, namespace, JSON.stringify(payload));
          break;
          
        case 'Appliance.Control.ToggleX':
          try {
            if (!Array.isArray(payload.togglex)) {
              payload.togglex = [payload.togglex]; // TODO: togglex. what about toggle?
            }
            payload.togglex.map((info) => {
              this.switchs[info.channel ? info.channel : 0].state = info.onoff;
            });   
          } catch (error) {
            console.error(`[Device][${this.name}] ${error.message}`);
          }                 
          break;

        case 'Appliance.System.Online':
          // Not mapped ability Appliance.System.Online for the device .
          // { online: { status: 1 } } // ONLINE -- { online: { status: 2 } } // OFFLINE
          
          try {
            if (payload.online.status === 1) {
              console.log(`[Device][${this.name}] Online.`);
              this.connected();
              return;
            }
            // console.log(this, payload);
            console.log(`[Device][${this.name}] Offline. TODO.`);
          } catch (error) {
            console.error(`[Device][${this.name}] ${error.message}`);
          }
          
          break;

        // Not mapped ability Appliance.System.Report for the device .
        // { report: [ { type: '1', value: '0', timestamp: 1547321502 } ] }

        // Not mapped ability Appliance.Control.ConsumptionX for the device .
        // { consumptionx:
        //   [ { date: '2019-01-01', time: 1546383598, value: 245 },
        //     ....
        //     { date: '2018-12-23', time: 1545597881, value: 6 } ] }

        default:
          console.warn(`Not mapped ability ${namespace} for the device ${this.uuid}.`);
          console.debug(payload);
          break;
      }     
    });    
  }

  connected() {
    console.log(`[Device][${this.name}] Device ${this.uuid}: connected`);
    // console.log(this.meross);
    this.switchs = [];
    this.meross.dev.channels.map((info, id) => {
      this.switchs.push(new Switch(id, this, info));
    });

    this.sensors = [];
    this.meross.getSystemAbilities((error, abilities) => {      
      this.meross.dev.channels.map((info, id) => {
        // console.log(this.name, abilities);
        try {
          if (error) {
            throw new Error(error);
          }

          if (!abilities.ability['Appliance.Control.ConsumptionX'] && !abilities.ability['Appliance.Control.Electricity']) {
            throw new Error(`The channel ${id} have not abilities to be a sensor`);
          }

          this.sensors[id] = [];

          if (abilities.ability['Appliance.Control.ConsumptionX']) {
            this.sensors[id].push(new Sensor(id, this, info, 'consumption'));
          }

          if (abilities.ability['Appliance.Control.Electricity']) {
            this.meross.getControlElectricity((error, electricity) => {
              if (error) {
                throw new Error(error);
              }
              for(let ability in electricity.electricity) {
                if (ability === 'channel') continue;
                this.sensors[id].push(new Sensor(id, this, info, ability));
              }
            });
          }
        } catch (error) {
          console.error(`[Device][${this.name}] ${error.message}`);
          return;
        }

      });      
      
    });
  }

  getInfo() {
    return {
      name: this.name,
      model: this.type,
      sw_version: this.fmwareVersion,
      identifiers: [
        this.uuid
      ]
    }
  }

}

module.exports = Device;

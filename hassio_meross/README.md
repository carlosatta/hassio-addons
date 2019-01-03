# Hassio Meross integration

## About
The purpose of **hassio-meross** is to provide an integration in **Home Assistant** form **Meross** devices. It’s works connecting to **Meross** API system and not directly to the devices.

[![Buy me a coffee][buymeacoffee-shield]][buymeacoffee]

## Devices
For now the addons was tested with this devices:
 - [MSS425F - Smart Wi-Fi Surge Protector (EU/FR/US/JP)](http://www.meross.com/products/home_automation/smart_wi_fi_surge_protect/36.html)
 - [MSS310 - Smart Wi-Fi Plug with Energy Monitor (UK/EU/US/AU/FR/IT)](http://www.meross.com/products/home_automation/smart_wi_fi_plug/22.html)

Probably  it's work with other devices.

## Instruction
All the devices have to be  configured via the Meross app.

The addons was created to work out of the box with [MQTT Discovery](https://www.home-assistant.io/docs/mqtt/discovery/), so I suggest to add at your *`configuration.yaml`* the following configurations:

 ```
Example configuration.yaml entry
mqtt:
  discovery: true
  discovery_prefix: homeassistant
```


Edit the addons config:
### mqtt
&nbsp;&nbsp;&nbsp;&nbsp;**host:** your mqtt host

&nbsp;&nbsp;&nbsp;&nbsp;**port:** the mqtt port (Default: 1883)

&nbsp;&nbsp;&nbsp;&nbsp;**protocol:** the protocol (mqtt|mqtts|ws|wss) (Default: mqtt)

&nbsp;&nbsp;&nbsp;&nbsp;**rejectUnauthorized:** If you are using a **self-signed certificate** (Default: false)
### topic
&nbsp;&nbsp;&nbsp;&nbsp;**discovery_prefix:** the topic prefix. To use Discovery mqtt functionality have to be the same value of *discovery_prefix* set in home assistant configuration. (Default: homeassistant)
### meross
&nbsp;&nbsp;&nbsp;&nbsp;**email:** the email used in the meross application

&nbsp;&nbsp;&nbsp;&nbsp;**password:** the password used in the meross application
### devices
&nbsp;&nbsp;&nbsp;&nbsp;**refresh:** the number of millisecond to refresh plugs statistics



[buymeacoffee-shield]: https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg
[buymeacoffee]: https://www.buymeacoffee.com/onr2X5F

'use strict';
require('events').EventEmitter.defaultMaxListeners = 0;

const options = require('./options.json');

const mqtt = require('./lib/mqtt')(options.mqtt);

const Meross = require('./lib/meross');
const meross = new Meross(options.meross);

const Channel = require('./Channel');
const EventEmitter = require('./EventEmitter');
const errors = require('./errors');

const filename = require('path').basename(__filename);
const debug = require('./debug')(`ghast:${filename}`);


let _count = 0;
const uniqueID = () => 'Chromecast #' + (++_count);


/**
 * A cast-compatible device.
 * Each device has a cast channel that may or may not be connected
 */
class Device extends EventEmitter {
  constructor(address, port = 8009, options = {}) {
    super();

    this.address = address;
    this.port    = port;
    this.id      = options.id || uniqueID();
    this.name    = options.name || options.fn || this.id;

    this._channel = null;
    this._isConnected = false;
    this._connections = new Set();
    this._timers = [];
  }

  start() {
    if (this._isConnected) return Promise.resolve();

    return new Promise((resolve, reject) => {
      this._channel = new Channel(this.address, this.port);

      this._channel.on('connected', () => {
        this._isConnected = true;
        resolve();
      });

      this._channel.on('message', (envelope) => {
        this.emit(envelope.namespace, envelope.message);
      });

      this._channel.on('close', (transportId) => {
        this._connections.delete(transportId);
        this.emit('close', transportId);
      });

      this._channel.on('disconnected', (err) => {
        this.stop();
        reject(err);
      });

      this._channel.start();
    });
  }

  stop() {
    debug('Device stopping');

    this._isConnected = false;
    this._connections.clear();
    this._timers.forEach(timer => clearTimeout(timer));

    this._channel.removeAllListeners();
    this._channel.stop();

    this.emit('disconnected');
  }

  send(message, namespace, destination, onSuccess, onError, timeout) {
    onError = onError || (() => {});
    timeout = timeout || 15 * 1000; // 15s default?

    if (!this._isConnected) {
      return onError(new errors.CastError(errors.codes.SESSION_ERROR));
    }

    // message can be split across different transport_ids
    // you have to subscribe/connect to a transport_id before you can
    // send/receive messages on it
    if (destination && !this._connections.has(destination)) {
      debug(`Not connected to '${destination}', connecting first...`);
      this._channel.connect(destination);
      this._connections.add(destination);
    }

    this._channel.send(message, namespace, destination);

    // cast messages use requestIDs to match responses to requests
    // not all messages expect a response so not all have requestIDs
    const requestId = message.requestId;
    let timer;

    if (!onSuccess) return debug.verbose('No onSuccess, skipping...');
    if (!requestId) return debug('No requestId, skipping...');

    const onMessage = (envelope) => {
      if (envelope.message.requestId === requestId) {
        const error = errors.check(envelope.message);
        const index = this._timers.indexOf(timer);

        clearTimeout(timer);
        this._timers.splice(index, 1);
        this._channel.removeListener('message', onMessage);

        (error)
          ? onError(error)
          : onSuccess(envelope.message, envelope.raw);
      }
    };

    timer = setTimeout(() => {
      debug(`Request #${requestId} timed out.`);

      const error = new errors.CastError(errors.codes.TIMEOUT, null, message);
      const index = this._timers.indexOf(timer);

      this._timers.splice(index, 1);
      this._channel.removeListener('message', onMessage);

      onError(error);
    }, timeout);

    this._timers.push(timer);
    this._channel.on('message', onMessage);
  }

}


module.exports = Device;

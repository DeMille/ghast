const tls = require('tls');
const path = require('path');
const EventEmitter = require('events').EventEmitter;

const ProtoBuf = require('protobufjs');

const filename = require('path').basename(__filename);
const debug = require('./debug')(`ghast:${filename}`);

const CONNECTION_NAMESPACE = 'urn:x-cast:com.google.cast.tp.connection';
const HEARTBEAT_NAMESPACE = 'urn:x-cast:com.google.cast.tp.heartbeat';
const RECEIVER_ID = 'receiver-0';


// build the protobuf maker
const proto = ProtoBuf
  .loadProtoFile(path.normalize(path.join(__dirname, 'cast_channel.proto')))
  .build('extensions.api.cast_channel');


/**
 * removes all null values from an object
 */
function compact(obj) {
  const clone = JSON.parse(JSON.stringify(obj))

  function deleteNil(o) {
    Object.keys(o).forEach((k) => {
      if (o[k] === null || o[k] === undefined) delete o[k];
      else if (typeof o[k] === 'object') deleteNil(o[k]);
    });
  }

  deleteNil(clone);
  return clone;
}


function makePayload(obj) {
  if (typeof obj === 'string') return obj;

  try {
    return JSON.stringify(compact(obj));
  } catch (err) {
    return obj;
  }
}


function getPayload(obj) {
  try {
    return JSON.parse(obj);
  } catch (err) {
    return obj;
  }
}


/**
 * Messages can come in chunks, so we keep state here until they
 * are built.
 */
class MessageBuilder extends EventEmitter {
  constructor() {
    super();
    this._len = 0;
    this._parts = [];
  }

  update(data) {
    if (!data) return;

    // get length from header
    if (!this._len) {
      this._len = data.readUInt32BE(0);
      return this.update(data.slice(4));
    }

    // assemble parts of current message, save any leftover chunks that
    // are part of the next message
    const part = data.slice(0, this._len);
    const next = data.slice(this._len);

    this._parts.push(part);
    this._len -= part.length;

    // end early if message not ready yet
    if (this._len > 0) return;

    const buf = Buffer.concat(this._parts);
    const msg = proto.CastMessage.decode(buf);
    this.emit('message', msg);

    // reset & start processing next if there's still data
    this._len = 0;
    this._parts = [];
    if (next.length) this.update(next);
  }
}


/**
 * A cast channel manages raw communication with a device.
 *
 * This manages 2 main things:
 * - getting actual messages to/from the device
 * - maintains a mandatory heartbeat ping/pong with the device
 */
class Channel extends EventEmitter {
  constructor(address, port) {
    super();

    this.address = address;
    this.port = port;
    this.id = 'sender-' + Math.random().toString(36).substr(2, 5);

    this._socket = null;
    this._ping = null;
    this._pong = null;
    this._waiting = null;

    this._builder = new MessageBuilder();
    this._builder.on('message', msg => this._onMessage(msg));
  }

  start() {
    debug(`Connecting to ${this.address}:${this.port}`);

    this._socket = tls.connect({
      host: this.address,
      port: this.port,
      rejectUnauthorized: false, // devices use self-signed certs
    });

    this._socket.on('readable', () => {
      this._builder.update(this._socket.read());
    });

    this._socket.on('secureConnect', () => {
      this._heartbeat();
      this.emit('connected');
    });

    this._socket.on('error', (err) => {
      debug('Socket error, stopping', err);
      this._teardown(err);
    });

    this._socket.on('close', () => {
      debug('Socket ended, stopping');
      this._teardown();
    });
  }

  stop() {
    debug('Channel stopping');
    this._teardown();
  }

  send(message, namespace, destination = RECEIVER_ID) {
    let payload_type = null;
    let payload_utf8 = null;
    let payload_binary = null;

    if (Buffer.isBuffer(message)) {
      payload_type = 'BINARY';
      payload_binary = message;
    } else {
      payload_type = 'STRING';
      payload_utf8 = makePayload(message);
    }

    const msg = {
      protocol_version: 0,
      source_id       : this.id,
      destination_id  : destination,
      namespace,
      payload_type,
      payload_utf8,
      payload_binary,
    };

    if (namespace === HEARTBEAT_NAMESPACE) {
      debug.verbose('\x1b[31m❤ \x1b[39m');
    } else {
      (debug.verbose.isEnabled)
        ? debug('Sending: \n\n%o\n\n', msg)
        : debug('Sending: %s', message.type || payload_type);
    }

    const data = (new proto.CastMessage(msg)).encode().toBuffer();
    const header = Buffer.alloc(4);
    header.writeUInt32BE(data.length, 0);

    this._socket.write(Buffer.concat([header, data]));
  }

  /**
   * you have to connect/subscribe to new destinations before communicating
   */
  connect(destination = RECEIVER_ID) {
    const msg = {type: 'CONNECT', origin: {}};
    const namespace = CONNECTION_NAMESPACE;

    this.send(msg, namespace, destination);
  }

  _teardown(err) {
    debug('Tearing down...');

    clearInterval(this._ping);
    clearTimeout(this._pong);

    if (this._socket) {
      this._socket.removeAllListeners();
      this._socket.destroy();
    }

    this.emit('disconnected', err);
  }

  _heartbeat() {
    const msg = {type: 'PING'};
    const namespace = HEARTBEAT_NAMESPACE;

    // first ping
    this.send(msg, namespace);

    // subsequent pings, 5s apart
    this._ping = setInterval(() => {
      this.send(msg, namespace);
      this._waiting = true;

      this._pong = setTimeout(() => {
        if (this._waiting) {
          debug('Missed heartbeat, stopping');
          this._teardown();
        }
      }, 4500);
    }, 5000);
  }

  _onMessage(msg) {
    // verify that message is addressed to this sender OR to anyone (*)
    if (msg.destination_id !== this.id && msg.destination_id !== '*') {
      debug(`Message for another sender ('${msg.destination_id}'), ignoring, \n%o\n`, msg);
      return;
    }

    msg.message = (msg.payload_utf8)
      ? getPayload(msg.payload_utf8)
      : msg.payload_binary;

    msg.raw = (msg.payload_utf8)
      ? msg.payload_utf8
      : msg.payload_binary;

    // check for heartbeats
    if (msg.namespace === HEARTBEAT_NAMESPACE) {
      debug.verbose('❤');
      this._waiting = false;
      return;
    }

    // check if the message is a connection close
    if (msg.namespace === CONNECTION_NAMESPACE && msg.message.type === 'CLOSE') {
      debug(`Connection to '${msg.source_id}' closed by receiver`);
      this.emit('close', msg.source_id);
      return;
    }

    const formatString = (debug.verbose.isEnabled)
      ? 'Incoming: %s\n\n%o\n\n'  // <-- full expanded obj
      : 'Incoming: %s\n\n%j\n\n'; // <-- compact json string

    (msg.payload_utf8)
      ? debug(formatString, msg.message.type, msg.message)
      : debug('Incoming: %s\n\n%o\n\n', 'Binary Message', msg.message);

    this.emit('message', msg);
  }
}


module.exports = Channel;

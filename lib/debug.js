const util = require('util');

const _ = require('lodash');

const enabledNamespaces = [];
const disabledNamespaces = [];

const enabledVerbose = [];
const disabledVerbose = [];

const colors = ['blue', 'green', 'magenta', 'yellow', 'cyan', 'red'];
let colorsIndex = 0;

const noop = () => {};
noop.verbose = noop;
noop.v = noop;
noop.isEnabled = false;
noop.verbose.isEnabled = false;
noop.v.isEnabled = false;

// so tests can rewire it
let logger = console.log;


// initialize
if (process.env.DEBUG) {
  process.env.DEBUG
    .replace(/\*/g, '.*?')
    .split(',')
    .filter(s => !!s)
    .forEach((namespace) => {
      (namespace.substr(0, 1) === '-')
        ? disabledNamespaces.push(namespace.substr(1))
        : enabledNamespaces.push(namespace);
    });
}

if (process.env.VERBOSE) {
  process.env.VERBOSE.replace(/\*/g, '.*?')
    .split(',')
    .filter(s => !!s)
    .forEach((namespace) => {
      (namespace.substr(0, 1) === '-')
        ? disabledVerbose.push(namespace.substr(1))
        : enabledVerbose.push(namespace);
    });
}


function namespaceIsEnabled(name) {
  if (!enabledNamespaces.length) return false;

  function matches(namespace) {
    return name.match(new RegExp(`^${namespace}$`));
  }

  if (disabledNamespaces.some(matches)) return false;
  if (enabledNamespaces.some(matches)) return true;

  return false;
}


function namespaceIsVerbose(name) {
  if (!enabledVerbose.length) return false;

  function matches(namespace) {
    return name.match(new RegExp(`^${namespace}$`));
  }

  if (disabledVerbose.some(matches)) return false;
  if (enabledVerbose.some(matches)) return true;

  return false;
}


function timestamp() {
  const now = new Date();

  const time = [
    _.padStart(now.getHours(), 2, 0),
    _.padStart(now.getMinutes(), 2, 0),
    _.padStart(now.getSeconds(), 2, 0),
    _.padStart(now.getMilliseconds(), 3, 0),
  ];

  return `[${time.join(':')}]`;
}


function stringify(arg, type) {
  if (type === '%s' || type === '%d') {
    return String(arg);
  }

  if (type === '%j') {
    return JSON.stringify(arg);
  }

  if (type === '%o' || _.isObject(arg)) {
    return util.inspect(arg, {colors: true, depth: null});
  }

  return String(arg);
}


function format(msg, ...args) {
  const hasFormatters = (typeof msg === 'string' && msg.match(/%[a-z]/));

  // replace format markers in message string with the formatted items
  // or, if none, just add formatted message to output. (msg could anything)
  let output = (hasFormatters)
    ? msg.replace(/%([a-z])/g, type => stringify(args.shift(), type))
    : stringify(msg);

  // add padding for printing surplus args left over
  if (args.length) output += ' ';

  // print args that didn't have a formatter
  output += args.map(arg => stringify(arg)).join(' ');

  // remove hanging newline at end and indent
  return output.replace(/\n$/, '').replace(/\n/g, '\n    ');
}


function colorize(str, color_str) {
  const ansi = {
    black:   30,
    red:     31,
    green:   32,
    yellow:  33,
    blue:    34,
    magenta: 35,
    cyan:    36,
    white:   37,
    grey:    90, // bright black
  };

  const code = (ansi[color_str] || 37);
  return `\x1B[${code}m${str}\x1B[0m`;
}


/**
 * Returns debug fn if debug is enabled, noop if not
 *
 * @param  {string} namespace
 * @return {function}
 */
module.exports = function debug(namespace) {
  if (!namespaceIsEnabled(namespace)) return noop;

  // shorten ghast:filename.js -> filename… becuase its driving me crazy
  let shortname = namespace.replace('ghast:', '');
  if (shortname.length > 10) shortname = shortname.substr(0, 9) + '…';
  if (shortname.length < 10) shortname = _.padEnd(shortname, 10);

  const color = colors[colorsIndex++ % colors.length];
  const prefix = colorize('•' + shortname, color);

  function logFn(msg, ...args) {
    // 'Device.js [10:41:54:482] '
    let output = `${prefix} ${colorize(timestamp(), 'grey')} `;
    output += format(msg, ...args);

    logger(output);
  }

  logFn.isEnabled = true;

  if (namespaceIsVerbose(namespace)) {
    logFn.verbose = logFn;
    logFn.v = logFn;
    logFn.verbose.isEnabled = true;
    logFn.v.isEnabled = true;
  } else {
    logFn.verbose = noop;
    logFn.v = noop;
  }

  return logFn;
};

class CastError {
  constructor(code, opt_description, opt_details) {
    this.code        = code;
    this.description = opt_description;
    this.details     = opt_details;
  }
}


// Enumerated error codes from the docs
const codes = {
  API_NOT_INITIALIZED     : 'api_not_initialized',
  CANCEL                  : 'cancel',
  CHANNEL_ERROR           : 'channel_error',
  EXTENSION_MISSING       : 'extension_missing',
  EXTENSION_NOT_COMPATIBLE: 'extension_not_compatible',
  LOAD_MEDIA_FAILED       : 'load_media_failed',
  INVALID_PARAMETER       : 'invalid_parameter',
  RECEIVER_UNAVAILABLE    : 'receiver_unavailable',
  SESSION_ERROR           : 'session_error',
  TIMEOUT                 : 'timeout',
};


// Other error type that might be seen in response messages, and a guess
// of what the correct error code to go with it should be.
// There are probably others that should be added to this list.
const otherErrorTypes = {
  LAUNCH_ERROR        : codes.RECEIVER_UNAVAILABLE,
  LOAD_CANCELLED      : codes.CANCEL,
  LOAD_FAILED         : codes.LOAD_MEDIA_FAILED,
  INVALID_PLAYER_STATE: codes.INVALID_PARAMETER,
  INVALID_REQUEST     : codes.INVALID_PARAMETER,
};


function check(message) {
  const code = message.type;

  if (Object.prototype.hasOwnProperty.call(codes, code)) {
    return new CastError(codes[code], message.reason, message);
  }

  if (Object.prototype.hasOwnProperty.call(otherErrorTypes, code)) {
    return new CastError(otherErrorTypes[code], message.reason, message);
  }
}


module.exports = {
  codes,
  CastError,
  check,
};

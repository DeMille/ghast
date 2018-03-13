const _ = require('lodash');

const ghast = require('./api');
const debug = require('./debug')('ghast:framework');

const framework = {};


/**
 * CastContext is responsible for dispatching these events:
 * - `framework.CastContextEventType.CAST_STATE_CHANGED`
 *   - meant to track icon state
 *   - emits `framework.CastStateEventData`
 *
 * - `framework.CastContextEventType.SESSION_STATE_CHANGED`
 *   - meant to track current cast session
 *   - emits `framework.SessionStateEventData`
 */
class CastContext {
  constructor() {
    this._castOptions  = null;
    this._isAvailable  = false;
    this._castState    = 'NO_DEVICES_AVAILABLE';
    this._sessionState = framework.SessionState.NO_SESSION;
    this._sessionId    = null;
    this._castSession  = null;
    this._listeners = new Map();
  }

  static getInstance() {
    return CastContext.instance || (CastContext.instance = new CastContext());
  }

  _emit(data) {
    (this._listeners.get(data.type) || []).forEach(fn => fn(data));
  }

  _onReceiverAction(receiver, action) {
    if (action === ghast.ReceiverAction.CAST && this._castSession) {
      this._updateSessionState(framework.SessionState.SESSION_STARTING);
    }

    if (action === ghast.ReceiverAction.STOP) {
      this._updateSessionState(framework.SessionState.SESSION_ENDING);
    }
  }

  _onReceiverUpdate(availability) {
    this._isAvailable = (availability === ghast.ReceiverAvailability.AVAILABLE);
    this._updateCastState();

    if (
      !this._castSession &&
      this._isAvailable &&
      this._sessionId &&
      this._castOptions.resumeSavedSession
    ) {
      ghast.requestSessionById(this._sessionId);
    }
  }

  _onSessionFound(session) {
    // this gets called when a new session is found from some auto-connect
    // - on add device
    // - on requestById()

    const state = framework.SessionState.SESSION_STARTED;
    this._castSession = new CastSession(session, state);
    this._sessionId = session.sessionId;

    session.addUpdateListener(this._onSessionUpdate.bind(this));
    this._updateSessionState(state);
  }

  _onSessionUpdate(isAlive) {
    if (this._castSession) return;
    const session = this._castSession.getCurrentSession();

    // @TODO: need to handle update / events here

    if (
      session.status === ghast.SessionStatus.STOPPED ||
      session.status === ghast.SessionStatus.DISCONNECTED
    ) {
      this._castSession = null;
      this._updateSessionState(framework.SessionState.SESSION_ENDED);
    }
  }

  _updateSessionState(state, errCode) {
    if (this._sessionState !== state) {
      this._sessionState === state;

      const event = new SessionStateEventData(
        this._castSession,
        this._sessionState,
        errCode
      );

      this._emit(event);
      this._updateCastState();
    }
  }

  _updateCastState() {
    const changeTo = (state) => {
      if (this._castState !== state) {
        this._castState = state;
        this._emit(new CastStateEventData(state));
      }
    };

    const curr = this._sessionState;
    const ss = framework.SessionState;

    if (curr === ss.SESSION_STARTED || curr === ss.SESSION_RESUMED) {
      changeTo(framework.CastState.CONNECTED);
    }

    if (curr === ss.SESSION_STARTING) {
      changeTo(framework.CastState.CONNECTING);
    }

    if (
      curr === ss.SESSION_ENDED ||
      curr === ss.SESSION_START_FAILED ||
      curr === ss.NO_SESSION
    ) {
      (this._isAvailable)
        ? changeTo(framework.CastState.NOT_CONNECTED)
        : changeTo(framework.CastState.NO_DEVICES_AVAILABLE);
    }
  }

  addEventListener(type, handler) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }

    this._listeners.get(type).add(handler);
  }

  endCurrentSession(stopCasting) {
    if (this._castSession) this._castSession.endSession(stopCasting);
  }

  getCastState() {
    return this._castState;
  }

  getCurrentSession() {
    return this._castSession;
  }

  getSessionState() {
    return this._sessionState;
  }

  removeEventListener(type, handler) {
    if (this._listeners.has(type)) {
      this._listeners.get(type).delete(handler);
    }
  }

  requestSession(device) {
    if (this._castOptions) throw new Error('Need to setOptions() first');

    return new Promise((resolve, reject) => {
      ghast.requestSession(resolve, err => reject(err.code), device);
    });
  }

  setOptions(options) {
    if (this._castOptions) return debug('Options alread set, ignoring');
    if (options.receiverApplicationId) throw new Error('Cast options missing app id');

    this._castOptions = options;

    const config = new ghast.ApiConfig(
      new ghast.SessionRequest(options.receiverApplicationId),
      session => this._sessionListener(session),
      availability => this._receiverListener(availability),
      options.autoJoinPolicy
    );

    ghast.initialize(config);
  }
}

/**
 * Holds the current instance
 */
CastContext.instance = null;


/**
 *
 * CastSession is responsible for dispatching `framework.SessionEventType`s
 *
 * - APPLICATION_STATUS_CHANGED   : status text changes
 * - APPLICATION_METADATA_CHANGED : id, images, name, or namespaces changes
 * - ACTIVE_INPUT_STATE_CHANGED   : receiver active input changes
 * - VOLUME_CHANGED               : volume/mute changes
 * - MEDIA_SESSION                : when a new media session is started
 *
 * first 4 get checked whenever the sessions updateListener gets fired
 * MEDIA_SESSION gets dispatched on loadMedia or the session's mediaUpdateListener
 *
 */
class CastSession {
  constructor(sessionObj, state) {
    this._session       = sessionObj;
    this._sessionState  = state;
    this._sessionId     = sessionObj.sessionId;
    this._statusText    = sessionObj.statusText;
    this._receiver      = sessionObj.receiver;
    this._volume        = sessionObj.receiver.volume;
    this._isActiveInput = sessionObj.receiver.isActiveInput;
    this._metadata      = new ApplicationMetadata(sessionObj);

    this._mediaSession = _.find(sessionObj.media, item => !item.idleReason);
    this._listeners = new Map();

    // @TODO: add the listeners
    // this._session.addUpdateListener();
    // this._session.addMediaListener();
  }

  _emit(data) {
    (this._listeners.get(data.type) || []).forEach(fn => fn(data));
  }

  _updateListener(isAlive) {
    const session    = this._session;
    const metadata   = this._metadata;
    const statusText = session.statusText
    const receiver   = session.receiver

    // APPLICATION_STATUS_CHANGED
    if (this._statusText !== statusText) {
      this._statusText = statusText;
      this._emit(new ApplicationStatusEventData(statusText));
    }

    // APPLICATION_METADATA_CHANGED
    if (
      metadata.applicationId !== session.appId ||
      metadata.name !== session.displayName ||
      !_.isEqual(metadata.namespaces, session.namespaces.map(obj => obj.name))
    ) {
      this._metadata = new ApplicationMetadata(session);
      this._emit(new ApplicationMetadataEventData(this._metadata));
    }

    // ACTIVE_INPUT_STATE_CHANGED
    if (this._isActiveInput !== receiver.isActiveInput) {
      this._isActiveInput = receiver.isActiveInput;
      this._emit(new ActiveInputStateEventData(receiver.isActiveInput));
    }

    // VOLUME_CHANGED
    if (
      this._volume.level !== receiver.volume.level ||
      this._volume.muted !== receiver.volume.muted
    ) {
      this._volume = receiver.volume;
      this._emit(new VolumeEventData(this._volume.level, this._volume.muted));
    }
  }

  _mediaListener(mediaSession) {
    this._mediaSession = mediaSession;
    this._emit(new MediaSessionEventData(mediaSession));
  }

  addEventListener(type, handler) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }

    this._listeners.get(type).add(handler);
  }

  addMessageListner(namespace, listener) {
    this.session.addMessageListener(namespace, listener);
  }

  endSession(stopCasting) {
    if (this.sessionState === 'SESSION_ENDED') {
      (stopCasting)
        ? this._session.stop()
        : this._session.leave();
    }
  }

  getActiveInputState() {
    return this._isActiveInput;
  }

  getApplicationMetadata() {
    return this._metadata;
  }

  getApplicationStatus() {
    return this._statusText;
  }

  getCastDevice() {
    return this._receiver;
  }

  getMediaSession() {
    return this._session;
  }

  getSessionId() {
    return this._sessionId;
  }

  getSessionObj() {
    return this._session;
  }

  getSessionState() {
    return this._sessionState;
  }

  getVolume() {
    return this._volume.level;
  }

  isMute() {
    return this._volume.muted;
  }

  loadMedia(loadRequest) {
    return new Promise((resolve, reject) => {
      const onSuccess = (mediaSession) => {
        this._mediaSession = mediaSession;
        this._emit(new MediaSessionEventData(mediaSession));
        resolve();
      };

      this._session.loadMedia(loadRequest, onSuccess, err => reject(err.code));
    });
  }

  removeEventListener(type, handler) {
    if (this._listeners.has(type)) {
      this._listeners.get(type).delete(handler);
    }
  }

  removeMessageListener(namespace, listener) {
    this.session.removeMessageListener(namespace, listener);
  }

  sendMessage(namespace, data) {
    return new Promise((resolve, reject) => {
      this._session.sendMessage(namespace, data, resolve, err => reject(err.code));
    });
  }

  setMute(isMute) {
    this._volume.muted = isMute;

    return new Promise((resolve, reject) => {
      this._session.setReceiverMuted(isMute, resolve, err => reject(err.code));
    });
  }

  setVolume(volume) {
    this._volume.level = volume;

    return new Promise((resolve, reject) => {
      this._session.setReceiverVolumeLevel(volume, resolve, err => reject(err.code));
    });
  }
}


// @TODO: need to decide what the defaults should be for this
class RemotePlayer {
  constructor() {
    this.canPause         = false;
    this.canSeek          = false;
    this.controller       = null;
    this.currentTime      = 0;
    this.displayName      = '';
    this.displayStatus    = '';
    this.duration         = 0;
    this.imageUrl         = null;
    this.isConnected      = false;
    this.isMediaLoaded    = false;
    this.isMuted          = false;
    this.isPaused         = false;
    this.mediaInfo        = null;
    this.playerState      = null;
    this.savedPlayerState = null;
    this.statusText       = '';
    this.title            = '';
    this.volumeLevel      = 1;

    this._listeners = new Map();

    // use a proxy to dispatch events whenever properties are changed
    return new Proxy(this, {
      set(self, key, value) {
        if (!self.hasOwnProperty(key)) return;
        if (self[key] === value) return;

        const any = framework.RemotePlayerEventType.ANY_CHANGE;
        const type = `${key}Changed`;

        self[key] = value;

        self._emit(new RemotePlayerChangedEvent(any, key, value));
        self._emit(new RemotePlayerChangedEvent(type, key, value));
      }
    });
  }

  _emit(data) {
    (this._listeners.get(data.type) || []).forEach(fn => fn(data));
  }

  _reset() {
    this.canPause         = false;
    this.canSeek          = false;
    this.controller       = null;
    this.currentTime      = 0;
    this.displayName      = '';
    this.displayStatus    = '';
    this.duration         = 0;
    this.imageUrl         = null;
    this.isConnected      = false;
    this.isMediaLoaded    = false;
    this.isMuted          = false;
    this.isPaused         = false;
    this.mediaInfo        = null;
    this.playerState      = null;
    this.savedPlayerState = null;
    this.statusText       = '';
    this.title            = '';
    this.volumeLevel      = 1;
  }

  addEventListener(type, handler) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }

    this._listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    if (this._listeners.has(type)) {
      this._listeners.get(type).delete(handler);
    }
  }
}


/**
 * RemotePlayerController is responsible for `RemotePlayerChangedEvent`s which
 * are fired when any properties on the given RemotePlayer change.
 */
class RemotePlayerController {
  constructor(player) {
    this._player = player;
    this._context = CastContext.getInstance();

    // get new sessions as they are found or created
    this._context.addEventListener(
      framework.SESSION_STATE_CHANGED,
      this._sessionStateChangeListener.bind(this)
    );

    // get new media sessions as they are found or created
    this._context.addEventListener(
      framework.SESSION_STATE_CHANGED,
      this._sessionStateChangeListener.bind(this)
    );

    // start with existign session if any
    this._castSession = this._context.getCurrentSession();
    this._sessionObj = this._castSession && this._castSession.getSessionObj();

    // need to get the active media session (if it exists)
    // need to get this everytime the underlying session changes
    this._mediaSession = _.find(this._sessionObj.media, item => !item.idleReason);
  }

  // change underlying session?
  _changeSession() {

  }

  // change underlying mediaSession?
  _changeMedia() {

  }

  _listen() {
    this._sessionObj.addUpdateListener();
  }

  _updatePlayer() {
    const session = null;
    const media = null;

    if (!session) {
      // save the last relevant state and reset
      this._player.savedPlayerState = {
        currentTime: this._player.currentTime,
        isPaused   : this._player.isPaused,
        mediaInfo  : this._player.mediaInfo,
      };

      this._player.reset();
    } else {
      this._player.savedPlayerState = null;
    }

    if (!media) {
      //
    }

    // from the session
    this._player.isConnected = !!session;
    this._player.displayName = session.displayName;
    this._player.statusText  = session.statusText;
    this._player.isMuted     = session.receiver.volume.isMuted;
    this._player.volumeLevel = session.receiver.volume.level;

    // from the media session
    this._player.canPause      = media.supportsCommand(ghast.media.MediaComman.PAUSE);
    this._player.canSeek       = media.supportsCommand(ghast.media.MediaComman.SEEK);
    this._player.currentTime   = media.getEstimatedTime();
    this._player.displayStatus = session.statusText || media.media.metadata.title;
    this._player.duration      = media.media.duration;
    this._player.imageUrl      = media.media.metadata.images[0];
    this._player.isMediaLoaded = media.playerState !== ghast.media.PlayerState.IDLE;
    this._player.isPaused      = media.playerState === ghast.media.PlayerState.PAUSED
    this._player.mediaInfo     = media.media;
    this._player.playerState   = media.playerState;
    this._player.title         = media.media.metadata.title
  }

  addEventListener(type, handler) {
    this._player.addEventListener(type, handler);
  }

  getFormattedTime(timeInSec) {
    // 'HH:MM:SS'
    return [
      ('00' + Math.floor(timeInSec / 3600)).slice(-2),
      ('00' + Math.floor(timeInSec / 60 % 60)).slice(-2),
      ('00' + Math.floor(timeInSec % 60)).slice(-2),
    ].join(':');
  }

  getSeekPosition(currentTime, duration) {
    // Live media has no duration, default to 0% ?
    return (duration === 0 || !duration)
      ? 0
      : (currentTime / duration) * 100;
  }

  getSeekTime(currentPercentage, duration) {
    // Live media has no duration, default to 0?
    return (duration === 0 || !duration)
      ? 0
      : (currentPercentage / 100) * duration;
  }

  muteOrUnmute() {

  }

  playOrPause() {
    if (!this._mediaSession) return;

    this._player.isPaused = !this._player.isPaused;

    if (this._player.isPaused) {
      this._mediaSession.pause(null, this._successCallback, this._errorCallback);
    } else {
      this._mediaSession.play(null, this._successCallback, this._errorCallback);
    }
  }

  removeEventListener(type, handler) {
    this._player.removeEventListener(type, handler);
  }

  seek() {
    if (!this._mediaSession) return debug('No associated media session, ignoring');

    const seekRequest = new ghast.media.SeekRequest();
    seekRequest.currentTime = this._player.currentTime;

    this._mediaSession.seek(seekRequest, this._successCallback, this._errorCallback);
  }

  setVolumeLevel() {
    this._session.setReceiverVolumeLevel(
      this._player.volumeLevel,
      this._successCallback,
      this._errorCallback
    );
  }

  stop() {
    if (!this._mediaSession) return debug('No associated media session, ignoring');
    this._mediaSession.stop(null, this._successCallback, this._errorCallback);
  }
}


module.exports = framework;

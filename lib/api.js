const _ = require('lodash');
const dnssd = require('dnssd');

const Device = require('./Device');
const errors = require('./errors');

const debug = require('./debug');
debug.media = debug('ghast:Media');
debug.session = debug('ghast:Session');
debug.state = debug('ghast:State');

const RECEIVER_NAMESPACE = 'urn:x-cast:com.google.cast.receiver';
const MEDIA_NAMESPACE = 'urn:x-cast:com.google.cast.media';
const RECEIVER_ID = 'receiver-0';


/**
 * For auto incrementing request IDs. Each request gets tagged with an ID so
 * requests can be matched with responses when they arrive.
 */
let _id = 0;
const uniqueID = () => ++_id;


/**
 * base
 */
const ghast = {};


/**
 * ghast.* properties:
 */
ghast.isAvailable = true;
ghast.VERSION = [1, 2]; // api version (major, minor)


/**
 * ghast.* enums:
 */
ghast.AutoJoinPolicy = {
  TAB_AND_ORIGIN_SCOPED   : 'tab_and_origin_scoped',
  CUSTOM_CONTROLLER_SCOPED: 'custom_controller_scoped',
  ORIGIN_SCOPED           : 'origin_scoped',
  PAGE_SCOPED             : 'page_scoped',
};

ghast.Capability = {
  AUDIO_IN       : 'audio_in',
  AUDIO_OUT      : 'audio_out',
  VIDEO_IN       : 'video_in',
  VIDEO_OUT      : 'video_out',
  MULTIZONE_GROUP: 'multizone_group',
};

ghast.DefaultActionPolicy = {
  CREATE_SESSION: 'create_session',
  CAST_THIS_TAB : 'cast_this_tab',
};

ghast.DialAppState = {
  RUNNING: 'running',
  STOPPED: 'stopped',
  ERROR  : 'error'
};

ghast.ErrorCode = errors.codes;

ghast.ReceiverAction = {
  CAST: 'cast',
  STOP: 'stop',
};

ghast.ReceiverAvailability = {
  AVAILABLE  : 'available',
  UNAVAILABLE: 'unavailable'
};

ghast.ReceiverType = {
  CAST   : 'cast',
  DIAL   : 'dial',
  HANGOUT: 'hangout',
  CUSTOM : 'custom',
};

ghast.SenderPlatform = {
  IOS    : 'ios',
  CHROME : 'chrome',
  ANDROID: 'android',
};

ghast.SessionStatus = {
  CONNECTED   : 'connected',
  DISCONNECTED: 'disconnected',
  STOPPED     : 'stopped',
};


/**
 * ghast.* methods:
 * most atr implemented further down
 */
ghast.addReceiverActionListener = () => {};
ghast.logMessage = () => {};
ghast.removeReceiverActionListener = () => {};
ghast.setCustomReceivers = () => {};
ghast.setReceiverDisplayStatus = () => {};
ghast.unescape = () => {};


/**
 * ghast.* constructors:
 */
ghast.ApiConfig = class ApiConfig {
  constructor(
    sessionRequest,
    sessionListener,
    receiverListener,
    opt_autoJoinPolicy = ghast.AutoJoinPolicy.TAB_AND_ORIGIN_SCOPED,
    opt_defaultActionPolicy = ghast.DefaultActionPolicy.CREATE_SESSION
  ) {
    this.sessionRequest      = sessionRequest;
    this.sessionListener     = sessionListener;
    this.receiverListener    = receiverListener;
    this.autoJoinPolicy      = opt_autoJoinPolicy;
    this.defaultActionPolicy = opt_defaultActionPolicy;
  }
};

ghast.DialRequest = class DialRequest {
  constructor(appName, opt_launchParameter) {
    this.appName         = appName;
    this.launchParameter = opt_launchParameter;
  }
};

ghast.Error = errors.CastError;

ghast.Image = class Image {
  constructor(url) {
    this.height = null;
    this.url    = url;
    this.width  = null;
  }
};

ghast.Receiver = class Receiver {
  constructor(label, friendlyName, opt_capabilities, opt_volume) {
    this.label        = label;
    this.friendlyName = friendlyName;
    this.capabilities = opt_capabilities;
    this.volume       = opt_volume;
  }
};

ghast.ReceiverActionListener = class ReceiverActionListener {};

ghast.ReceiverDisplayStatus = class ReceiverDisplayStatus {
  constructor(statusText, appImages) {
    this.appImages  = appImages;
    this.showStop   = null;
    this.statusText = statusText;
  }
};

ghast.SenderApplication = class SenderApplication {
  constructor(platform) {
    this.packageId = null;
    this.platform  = platform;
    this.url       = null;
  }
};

// ghast.Session below

ghast.SessionRequest = class SessionRequest {
  constructor(appId, opt_capabilities, opt_timeout) {
    this.appId = appId;
    this.requestSessionTimeout = opt_timeout || 10 * 1000;
    this.capabilities = opt_capabilities || [
      ghast.Capability.AUDIO_OUT,
      ghast.Capability.VIDEO_OUT
    ];
  }
};

ghast.Timeout = class Timeout {};

ghast.Volume = class Volume {
  constructor(opt_level, opt_muted) {
    this.level = opt_level;
    this.muted = opt_muted;
  }
};


/**
 * ghast.media.*
 */
ghast.media = {};


/**
 * ghast.media.* properties
 */
ghast.media.DEFAULT_MEDIA_RECEIVER_APP_ID = 'CC1AD845';
ghast.media.timeout = {};


/**
 * ghast.media.* enums
 */
ghast.media.IdleReason = {
  CANCELLED:   'CANCELLED',
  INTERRUPTED: 'INTERRUPTED',
  FINISHED:    'FINISHED',
  ERROR:       'ERROR',
};

ghast.media.MediaCommand = {
  PAUSE        : 'pause',
  SEEK         : 'seek',
  STREAM_VOLUME: 'stream_volume',
  STREAM_MUTE  : 'stream_mute',
  SKIP_FORWARD : 'skip_forward',
  SKIP_BACKWARD: 'skip_backward',
};

ghast.media.MetadataType = {
  GENERIC    : 0,
  MOVIE      : 1,
  TV_SHOW    : 2,
  MUSIC_TRACK: 3,
  PHOTO      : 4,
};

ghast.media.PlayerState = {
  IDLE     : 'IDLE',
  PLAYING  : 'PLAYING',
  PAUSED   : 'PAUSED',
  BUFFERING: 'BUFFERING',
};

ghast.media.RepeatMode = {
  OFF            : 'REPEAT_OFF',
  ALL            : 'REPEAT_ALL',
  SINGLE         : 'REPEAT_SINGLE',
  ALL_AND_SHUFFLE: 'REPEAT_ALL_AND_SHUFFLE',
};

ghast.media.ResumeState = {
  PLAYBACK_START: 'PLAYBACK_START',
  PLAYBACK_PAUSE: 'PLAYBACK_PAUSE',
};

ghast.media.StreamType = {
  BUFFERED: 'BUFFERED',
  LIVE    : 'LIVE',
  OTHER   : 'OTHER',
};

ghast.media.TextTrackEdgeType = {
  NONE       : 'NONE',
  OUTLINE    : 'OUTLINE',
  DROP_SHADOW: 'DROP_SHADOW',
  RAISED     : 'RAISED',
  DEPRESSED  : 'DEPRESSED',
};

ghast.media.TextTrackFontGenericFamily = {
  SANS_SERIF           : 'SANS_SERIF',
  MONOSPACED_SANS_SERIF: 'MONOSPACED_SANS_SERIF',
  SERIF                : 'SERIF',
  MONOSPACED_SERIF     : 'MONOSPACED_SERIF',
  CASUAL               : 'CASUAL',
  CURSIVE              : 'CURSIVE',
  SMALL_CAPITALS       : 'SMALL_CAPITALS',
};

ghast.media.TextTrackFontStyle  = {
  NORMAL     : 'NORMAL',
  BOLD       : 'BOLD',
  BOLD_ITALIC: 'BOLD_ITALIC',
  ITALIC     : 'ITALIC'
};

ghast.media.TextTrackType = {
  SUBTITLES   : 'SUBTITLES',
  CAPTIONS    : 'CAPTIONS',
  DESCRIPTIONS: 'DESCRIPTIONS',
  CHAPTERS    : 'CHAPTERS',
  METADATA    : 'METADATA',
};

ghast.media.TextTrackWindowType = {
  NONE           : 'NONE',
  NORMAL         : 'NORMAL',
  ROUNDED_CORNERS: 'ROUNDED_CORNERS',
};

ghast.media.TrackType = {
  TEXT : 'TEXT',
  AUDIO: 'AUDIO',
  VIDEO: 'VIDEO'
};

ghast.media.StreamType = {
  BUFFERED: 'BUFFERED',
  LIVE    : 'LIVE',
  OTHER   : 'OTHER',
};


/**
 * ghast.media.* constructors
 */
ghast.media.EditTracksInfoRequest = class EditTracksInfoRequest {
  constructor(opt_activeTrackIds, opt_textTrackStyle) {
    this.type           = 'EDIT_TRACKS_INFO';
    this.requestId      = uniqueID();
    this.sessionId      = null; // can't be null
    this.mediaSessionId = null; // set by media._send()
    this.activeTrackIds = opt_activeTrackIds || [];
    this.textTrackStyle = opt_textTrackStyle;
  }
};

ghast.media.GenericMediaMetadata = class GenericMediaMetadata {
  constructor() {
    this.images       = [];
    this.metadataType = ghast.media.MetadataType.GENERIC;
    this.releaseDate  = null;
    this.releaseYear  = null; // deprecated
    this.subtitle     = null;
    this.title        = null;
    this.type         = ghast.media.MetadataType.GENERIC; // deprecated
  }
};

ghast.media.GetStatusRequest = class GetStatusRequest {
  constructor() {
    this.type           = 'GET_STATUS';
    this.requestId      = uniqueID();
    this.sessionId      = null; // can't be null
    this.mediaSessionId = null; // set by media._send()
    this.customData     = null;
  }
};

ghast.media.LoadRequest = class LoadRequest {
  constructor(mediaInfo) {
    this.type           = 'LOAD';
    this.requestId      = uniqueID();
    this.sessionId      = null; // can't be null
    this.mediaSessionId = null; // set by media._send()
    this.activeTrackIds = [];
    this.autoplay       = true;
    this.currentTime    = null;
    this.customData     = null;
    this.media          = mediaInfo;
    this.sessionId      = null;
  }
};

// ghast.media.Media

ghast.media.MediaInfo = class MediaInfo {
  constructor(contentId, contentType) {
    this.contentId      = contentId;
    this.contentType    = contentType;
    this.customData     = null;
    this.duration       = null;
    this.metadata       = null;
    this.streamType     = ghast.media.StreamType.BUFFERED;
    this.textTrackStyle = null;
    this.tracks         = [];
  }
};

ghast.media.MovieMediaMetadata = class MovieMediaMetadata {
  constructor() {
    this.images       = [];
    this.metadataType = ghast.media.MetadataType.MOVIE;
    this.releaseDate  = null;
    this.releaseYear  = null; // deprecated
    this.studio       = null;
    this.subtitle     = null;
    this.title        = null;
    this.type         = ghast.media.MetadataType.MOVIE; // deprecated
  }
};

ghast.media.MusicTrackMediaMetadata = class MusicTrackMediaMetadata {
  constructor() {
    this.albumArtist  = null;
    this.albumName    = null;
    this.artist       = null;
    this.artistName   = null; // deprecated
    this.composer     = null;
    this.discNumber   = null;
    this.images       = [];
    this.metadataType = ghast.media.MetadataType.MUSIC_TRACK;
    this.releaseDate  = null;
    this.releaseYear  = null; // deprecated
    this.songName     = null;
    this.title        = null;
    this.trackNumber  = null;
    this.type         = ghast.media.MetadataType.MUSIC_TRACK; // deprecated
  }
};

ghast.media.PauseRequest = class PauseRequest {
  constructor() {
    this.type           = 'PAUSE';
    this.requestId      = uniqueID();
    this.sessionId      = null; // can't be null
    this.mediaSessionId = null; // set by media._send()
    this.customData     = null;
  }
};

ghast.media.PhotoMediaMetadata = class PhotoMediaMetadata {
  constructor() {
    this.artist           = null;
    this.creationDateTime = null;
    this.height           = null;
    this.images           = [];
    this.latitude         = null;
    this.location         = null;
    this.longitude        = null;
    this.metadataType     = ghast.media.MetadataType.PHOTO;
    this.title            = null;
    this.type             = ghast.media.MetadataType.PHOTO; // deprecated
    this.width            = null;
  }
};

ghast.media.PlayRequest = class PlayRequest {
  constructor() {
    this.type           = 'PLAY';
    this.requestId      = uniqueID();
    this.sessionId      = null; // can't be null
    this.mediaSessionId = null; // set by media._send()
    this.customData     = null;
  }
};

ghast.media.QueueInsertItemsRequest = class QueueInsertItemsRequest {
  constructor(itemsToInsert) {
    this.type           = 'QUEUE_INSERT';
    this.requestId      = uniqueID();
    this.sessionId      = null; // can't be null
    this.mediaSessionId = null; // set by media._send()
    this.customData     = null;
    this.insertBefore   = null;
    this.items          = itemsToInsert;
  }
};

ghast.media.QueueItem = class QueueItem {
  constructor(mediaInfo) {
    this.activeTrackIds   = [];
    this.autoplay         = true;
    this.customData       = null;
    this.itemId           = null;
    this.media            = mediaInfo;
    this.playbackDuration = null;
    this.preloadTime      = 0;
    this.startTime        = 0;
  }
};

ghast.media.QueueLoadRequest = class QueueLoadRequest {
  constructor(items) {
    this.type           = 'QUEUE_LOAD';
    this.requestId      = uniqueID();
    this.sessionId      = null; // can't be null
    this.mediaSessionId = null; // set by media._send()
    this.customData     = null;
    this.items          = items;
    this.repeatMode     = ghast.media.RepeatMode.OFF;
    this.startIndex     = 0;
  }
};

ghast.media.QueueRemoveItemsRequest = class QueueRemoveItemsRequest {
  constructor(itemIdsToRemove) {
    this.type           = 'QUEUE_REMOVE';
    this.requestId      = uniqueID();
    this.sessionId      = null; // can't be null
    this.mediaSessionId = null; // set by media._send()
    this.customData     = null;
    this.itemIds        = itemIdsToRemove;
  }
};

ghast.media.QueueReorderItemsRequest = class QueueReorderItemsRequest {
  constructor(itemIdsToReorder) {
    this.type           = 'QUEUE_REORDER';
    this.requestId      = uniqueID();
    this.sessionId      = null; // can't be null
    this.mediaSessionId = null; // set by media._send()
    this.customData     = null;
    this.insertBefore   = null;
    this.itemIds        = itemIdsToReorder;
  }
};

ghast.media.QueueUpdateItemsRequest = class QueueUpdateItemsRequest {
  constructor(itemsToUpdate) {
    this.type           = 'QUEUE_UPDATE';
    this.requestId      = uniqueID();
    this.sessionId      = null; // can't be null
    this.mediaSessionId = null; // set by media._send()
    this.customData     = null;
    this.items          = itemsToUpdate;
  }
};

ghast.media.SeekRequest = class SeekRequest {
  constructor() {
    this.type           = 'SEEK';
    this.requestId      = uniqueID();
    this.sessionId      = null; // can't be null
    this.mediaSessionId = null; // set by media._send()
    this.currentTime    = null;
    this.customData     = null;
    this.resumeState    = null;
  }
};

ghast.media.StopRequest = class StopRequest {
  constructor() {
    this.type           = 'STOP';
    this.requestId      = uniqueID();
    this.sessionId      = null; // can't be null
    this.mediaSessionId = null; // set by media._send()
    this.customData     = null;
  }
};

ghast.media.TextTrackStyle = class TextTrackStyle {
  constructor() {
    this.backgroundColor           = null;
    this.customData                = null;
    this.edgeColor                 = null;
    this.edgeType                  = null;
    this.fontFamily                = null;
    this.fontGenericFamily         = null;
    this.fontScale                 = null;
    this.fontStyle                 = null;
    this.foregroundColor           = null;
    this.windowColor               = null;
    this.windowRoundedCornerRadius = null;
    this.windowType                = null;
  }
};

ghast.media.Track = class Track {
  constructor(trackId, trackType) {
    this.customData       = null;
    this.language         = null;
    this.name             = null;
    this.subtype          = null;
    this.trackContentId   = null;
    this.trackContentType = null;
    this.trackId          = trackId;
    this.type             = trackType;
  }
};

ghast.media.TvShowMediaMetadata = class TvShowMediaMetadata {
  constructor() {
    this.episode         = null;
    this.episodeNumber   = null; // deprecated
    this.episodeTitle    = null; // deprecated
    this.images          = [];
    this.metadataType    = ghast.media.MetadataType.TV_SHOW;
    this.originalAirdate = null;
    this.releaseYear     = null; // deprecated
    this.season          = null;
    this.seasonNumber    = null; // deprecated
    this.seriesTitle     = null;
    this.title           = null;
    this.type            = ghast.media.MetadataType.TV_SHOW; // deprecated
  }
};

ghast.media.VolumeRequest = class VolumeRequest {
  constructor(volume) {
    this.type           = 'SET_VOLUME';
    this.requestId      = uniqueID();
    this.sessionId      = null; // can't be null
    this.mediaSessionId = null; // set by media._send()
    this.customData     = null;
    this.volume         = volume;
  }
};


class AppAvailabilityRequest {
  constructor(appId) {
    this.type      = 'GET_APP_AVAILABILITY';
    this.requestId = uniqueID();
    this.appId     = [appId];
  }
}

class AppLaunchRequest {
  constructor(appId) {
    this.type      = 'LAUNCH';
    this.requestId = uniqueID();
    this.appId     = appId;
  }
}

class ReceiverVolumeRequest {
  constructor(volume) {
    this.type      = 'SET_VOLUME';
    this.requestId = uniqueID();
    this.volume    = volume;
  }
}

class ReceiverStopRequest {
  constructor(sessionId) {
    this.type      = 'STOP';
    this.requestId = uniqueID();
    this.sessionId = sessionId;
  }
}

class ReceiverStatusRequest {
  constructor() {
    this.type      = 'GET_STATUS';
    this.requestId = uniqueID();
  }
}


/**
 * ghast.media.Media
 * Manages communication on the media namespace
 */
class MediaSession {
  constructor(sessionId, mediaSessionId) {
    this.activeTrackIds         = [];
    this.currentItemId          = null;
    this.currentTime            = 0; // deprecated
    this.customData             = null;
    this.idleReason             = ghast.media.PlayerState.IDLE;
    this.items                  = null;
    this.loadingItemId          = null;
    this.media                  = null;
    this.mediaSessionId         = mediaSessionId;
    this.playbackRate           = 1;
    this.playerState            = null;
    this.preloadedItemId        = null;
    this.repeatMode             = ghast.media.RepeatMode.OFF;
    this.sessionId              = sessionId;
    this.supportedMediaCommands = [];
    this.volume                 = new ghast.Volume();

    this._device          = null;
    this._transportId     = null;
    this._updateListeners = new Set();
    this._lastUpdate      = null;
    this._isInitialized   = false;
    this._isAlive         = false;
  }

  static create(status, sessionId, transportId, device) {
    debug.media('Creating MediaSession:', status.mediaSessionId);

    const media = new MediaSession(sessionId, status.mediaSessionId);
    media._transportId = transportId;
    media._init(device, status);

    return media;
  }

  _init(device, status) {
    this._device = device;
    this._update(status);

    const onMediaMessage = (message) => {
      if (message.type !== 'MEDIA_STATUS') return;

      // get relevant status update for this session
      const info = message.status.find(s => s.mediaSessionId === this.mediaSessionId);
      if (info) this._update(info);
    };

    const onClose = (transportId) => {
      if (transportId === this._transportId) this._teardown();
    };

    this._device.using(this)
      .on(MEDIA_NAMESPACE, onMediaMessage)
      .once('close', onClose)
      .once('disconnected', () => this._teardown());

    this._isInitialized = true;
    this._isAlive = true;
  }

  /*
   * Changes to the following properties will trigger the listener:
   * currentTime, volume, metadata, playbackRate, playerState, customData.
   * `getStatus()` method will also trigger
   */
  _update(status) {
    debug.media('Updating media session...');

    // recursivly merge status onto self
    _.merge(this, status);

    if (Number.isInteger(this.supportedMediaCommands)) {
      this.supportedMediaCommands = this._parseSupported(this.supportedMediaCommands);
    }

    if (this.playerState === ghast.media.PlayerState.PLAYING || !!status.currentTime) {
      this._lastUpdate = Date.now();
    }

    // isAlive: is not idle OR, if it is idle, it is currently loading something
    const isAlive = status.playerState !== 'IDLE' || !!status.loadingItemId;

    if (isAlive) {
      this._updateListeners.forEach(fn => fn(true));
    } else {
      debug.media('MediaSession is dead!');
      this._teardown();
    }
  }

  _teardown() {
    debug.media('Stopped, cleaning up');
    this._isAlive = false;

    this._device.removeListenersCreatedBy(this);
    this._updateListeners.forEach(listener => listener(false));
  }

  addUpdateListener(listener) {
    this._updateListeners.add(listener);
  }

  editTracksInfo(editTracksInfoRequest, onSuccess, onError) {
    this._send(editTracksInfoRequest, onSuccess, onError);
  }

  getEstimatedTime() {
    if (this.playerState !== ghast.media.PlayerState.PLAYING) {
      return this.currentTime;
    }

    const duration = this.media && this.media.duration;
    const elapsedSeconds = ((Date.now() - this._lastUpdate)/1000) * this.playbackRate;
    const estimate = this.currentTime + elapsedSeconds;

    // bounds check:
    if (estimate < 0) return 0;
    if (duration && estimate > duration) return duration;

    return estimate;
  }

  getStatus(getStatusRequest, onSuccess, onError) {
    const request = getStatusRequest || new ghast.media.GetStatusRequest();
    this._send(request, onSuccess, onError);
  }

  pause(pauseRequest, onSuccess, onError) {
    const request = pauseRequest || new ghast.media.PauseRequest();
    this._send(request, onSuccess, onError);
  }

  play(playRequest, onSuccess, onError) {
    const request = playRequest || new ghast.media.PlayRequest();
    this._send(request, onSuccess, onError);
  }

  queueAppendItem(queueItem, onSuccess, onError) {
    const request = new ghast.media.QueueInsertItemsRequest([queueItem]);
    this._send(request, onSuccess, onError);
  }

  queueInsertItems(queueInsertItemsRequest, onSuccess, onError) {
    this._send(queueInsertItemsRequest, onSuccess, onError);
  }

  queueJumpToItem(itemId, onSuccess, onError) {
    // if itemId doesn't exist in queue, silently return
    if (!_.find(this.items, item => item.id === itemId)) return;

    const request = new ghast.media.QueueJumpRequest();
    request.currentItemId = itemId;

    this._send(request, onSuccess, onError);
  }

  queueMoveItemToNewIndex(itemId, newIndex, onSuccess, onError) {
    const currentIndex = _.findIndex(this.items, item => item.id === itemId);

    // if itemId doesn't exist in queue, silently return
    if (currentIndex === -1) return;
    if (currentIndex === newIndex) return onSuccess && onSuccess();

    // find the item id of the item that we are moving behind
    const before = (newIndex > currentIndex) ? newIndex + 1 : newIndex;
    const id = (!!this.items[before]) ? this.items[before].id : null;

    const request = new ghast.media.QueueReorderItemsRequest([itemId]);
    request.insertBefore = id; // <-- itemId, not queue index position

    this._send(request, onSuccess, onError);
  }

  queueNext(onSuccess, onError) {
    const request = new ghast.media.QueueJumpRequest();
    request.jump = 1;

    this._send(request, onSuccess, onError);
  }

  queuePrev(onSuccess, onError) {
    const request = new ghast.media.QueueJumpRequest();
    request.jump = -1;

    this._send(request, onSuccess, onError);
  }

  queueRemoveItem(itemId, onSuccess, onError) {
    // if itemId doesn't exist in queue, silently return
    if (!_.find(this.items, item => item.id === itemId)) return;

    const request = new ghast.media.QueueRemoveItemsRequest([itemId]);
    this._send(request, onSuccess, onError);
  }

  queueReorderItems(queueReorderItemsRequest, onSuccess, onError) {
    this._send(queueReorderItemsRequest, onSuccess, onError);
  }

  queueSetRepeatMode(repeatMode, onSuccess, onError) {
    const request = new ghast.media.QueueSetPropertiesRequest();
    request.repeatMode = repeatMode;

    this._send(request, onSuccess, onError);
  }

  queueUpdateItems(queueUpdateItemsRequest, onSuccess, onError) {
    this._send(queueUpdateItemsRequest, onSuccess, onError);
  }

  removeUpdateListener(listener) {
    this._updateListeners.delete(listener);
  }

  seek(seekRequest, onSuccess, onError) {
    this._send(seekRequest, onSuccess, onError);
  }

  setVolume(volumeRequest, onSuccess, onError) {
    this._send(volumeRequest, onSuccess, onError);
  }

  stop(stopRequest, onSuccess, onError) {
    const request = stopRequest || new ghast.media.StopRequest();

    this._send(request, onSuccess, onError);
  }

  supportsCommand(command) {
    return !!~this.supportedMediaCommands.indexOf(command);
  }

  _parseSupported(num) {
    const commands = {
      pause        : 1,
      seek         : 2,
      stream_mute  : 4,
      stream_volume: 8,
      skip_forward : 16,
      skip_backward: 32,
    };

    const supported = [];

    Object.keys(commands).forEach((cmd) => {
      if (num & commands[cmd]) {
        supported.push(cmd);
      }
    });

    return supported;
  }

  _send(message, onSuccess, onError) {
    if (!this._isInitialized || !this._isAlive) {
      if (onError) onError(new ghast.Error(ghast.ErrorCode.SESSION_ERROR));
      return;
    }

    const namespace = MEDIA_NAMESPACE;
    const destination = this._transportId;
    message.mediaSessionId = this.mediaSessionId;

    const onComplete = (msg) => {
      if (!msg.status || !msg.status.length) {
        onError && onError(new ghast.Error(ghast.ErrorCode.SESSION_ERROR));
      } else {
        onSuccess && onSuccess();
      }
    };

    this._device.send(message, namespace, destination, onComplete, onError);
  }
}


/**
 * ghast.Session
 * Manages general connection to an active application.
 */
class Session {
  constructor(sessionId, appId, displayName, appImages, receiver) {
    this.appId       = appId;
    this.appImages   = appImages || [];
    this.displayName = displayName;
    this.media       = [];
    this.namespaces  = [];
    this.receiver    = receiver;
    this.senderApps  = []; // ?
    this.sessionId   = sessionId;
    this.status      = ghast.SessionStatus.DISCONNECTED;
    this.statusText  = '';
    this.transportId = '';

    this._device = null;
    this._isInitialized = false;
    this._loading = 0;
    this._mediaListeners = new Set();
    this._updateListeners = new Set();
    this._messageListeners = new Map();
  }

  static create(message, device) {
    // `app` is the current active application
    const app = message.status.applications[0];

    const volume = new ghast.Volume(
      message.status.volume.level,
      message.status.volume.muted
    );

    const receiver = new ghast.Receiver(
      device.label,
      device.friendlyName,
      null,
      volume
    );

    const session = new ghast.Session(
      app.sessionId,
      app.appId,
      app.displayName,
      [], // appImages @TODO
      receiver
    );

    session.namespaces  = app.namespaces;
    session.sessionId   = app.sessionId;
    session.transportId = app.transportId;
    session.status      = ghast.SessionStatus.CONNECTED;
    session._device     = device;

    session._onReceiverStatus(message);
    session._init();

    return session;
  }

  _init() {
    const onReceiverMessage = (message) => {
      if (message.type === 'RECEIVER_STATUS') this._onReceiverStatus(message);
    };

    const onMediaMessage = (message) => {
      if (message.type === 'MEDIA_STATUS') this._onMediaStatus(message);
    };

    const onClose = (transportId) => {
      if (transportId === this.transportId) this._teardown();
    };

    this._device.using(this)
      .on(RECEIVER_NAMESPACE, onReceiverMessage)
      .on(MEDIA_NAMESPACE, onMediaMessage)
      .once('close', onClose)
      .once('disconnected', () => this._teardown());

    this._isInitialized = true;

    if (!!this.namespaces.find(obj => obj.name === MEDIA_NAMESPACE)) {
      this._getMediaStatus();
    }
  }

  _teardown() {
    debug.session('Session cleaning up');

    this._device.removeListenersCreatedBy(this);
    this._device.stop();

    this.status = ghast.SessionStatus.DISCONNECTED;
    this._updateListeners.forEach(fn => fn(false));
  }

  /**
   * Changes that trigger listener:
   * statusText, namespaces, status, and receiver volume
   */
  _onReceiverStatus(message) {
    const appId      = _.get(message, 'status.applications[0].appId');
    const statusText = _.get(message, 'status.applications[0].statusText');
    const namespaces = _.get(message, 'status.applications[0].namespaces');
    const level      = _.get(message, 'status.volume.level');
    const muted      = _.get(message, 'status.volume.muted');

    let hasChanges = false;

    if (!_.isNil(appId) && this.appId !== appId) {
      debug.session('App ID changed, session is dead');
      return this._teardown();
    }

    if (!_.isNil(statusText) && this.statusText !== statusText) {
      this.statusText = statusText;
      hasChanges = true;
    }

    if (!_.isNil(namespaces) && !_.isEqual(this.namespaces, namespaces)) {
      this.namespaces = namespaces;
      hasChanges = true;
    }

    if (!_.isNil(level) && this.receiver.volume.level !== level) {
      this.receiver.volume.level = level;
      hasChanges = true;
    }

    if (!_.isNil(muted) && this.receiver.volume.muted !== muted) {
      this.receiver.volume.muted = muted;
      hasChanges = true;
    }

    // announce changes
    if (hasChanges) {
      this._updateListeners.forEach(listener => listener(true));
    }
  }

  /**
   * Fires updateListeners only for _newly_ found media
   * (generally media updates are handled by MediaSession)
   */
  _onMediaStatus(message) {
    // ignore updates when waiting for loadMedia() calls to get a response
    if (this._loading > 0) {
      return debug.session('Ignoring media update until load resolves...');
    }

    // need to check each status update (may have multiple here)
    message.status.forEach((status) => {
      // dead == idle and not loading anything next in items queue
      const isDead = (status.playerState === 'IDLE' && !status.loadingItemId);
      const index = this.media.findIndex(m => m.mediaSessionId === status.mediaSessionId);
      const isKnown = (index !== -1);

      // add media sessions created from other senders:
      if (!isKnown && !isDead) {
        debug.session('Found external media item:');

        const media = MediaSession.create(
          status,
          this.sessionId,
          this.transportId,
          this._device
        );

        this.media.push(media);
        this._mediaListeners.forEach(listener => listener(media));
      }

      // remove media sessions from this.media as they expire:
      if (isKnown && isDead) {
        debug.session(`Removing dead media session: ${status.mediaSessionId}`);
        this.media.splice(index, 1);
      }
    });
  }

  _getMediaStatus(onSuccess, onError) {
    const request = new ReceiverStatusRequest();
    const namespace = MEDIA_NAMESPACE;
    const destination = this.transportId;

    this._send(request, onSuccess, onError, namespace, destination);
  }

  addMediaListener(listener) {
    this._mediaListeners.add(listener);
  }

  addMessageListener(namespace, listener) {
    if (!this._messageListeners.has(namespace)) {
      this._messageListeners.set(namespace, new Set());
    }

    this._messageListeners.get(namespace).add(listener);
    this._device.using(this).on(namespace, (msg, raw) => listener(raw));
  }

  addUpdateListener(listener) {
    this._updateListeners.add(listener);
  }

  leave(onSuccess, onError) {
    // @TODO
    // This is _supposed_ kick off this sender and all other senders within
    // the scope of the given autoJoinPolicy. Then, if no other senders are
    // connected, the receiver is stopped.
    //
    // Right now it just closes everything down:
    this._teardown();
    if (onSuccess) onSuccess();
  }

  loadMedia(loadRequest, onSuccess, onError) {
    // an attempt to manage multiple async load/queue operations:
    this._loading++;

    const namespace = MEDIA_NAMESPACE;
    const destination = this.transportId;
    loadRequest.sessionId = this.sessionId;

    const onFail = (err) => {
      this._loading--;
      if (onError) onError(err);
    };

    const onComplete = (message) => {
      if (!message.status || !message.status.length) {
        return onFail(new ghast.Error(ghast.ErrorCode.LOAD_MEDIA_FAILED));
      }

      const media = MediaSession.create(
        message.status[0],
        this.sessionId,
        this.transportId,
        this._device
      );

      this.media.push(media);
      this._loading--;

      if (onSuccess) onSuccess(media);
    };

    this._send(loadRequest, onComplete, onFail, namespace, destination);
  }

  queueLoad(queueLoadRequest, onSuccess, onError) {
    // an attempt to manage multiple async load/queue operations:
    this._loading++;

    const namespace = MEDIA_NAMESPACE;
    const destination = this.transportId;
    queueLoadRequest.sessionId = this.sessionId;

    const onFail = (err) => {
      this._loading--;
      if (onError) onError(err);
    };

    const onComplete = (message) => {
      if (!message.status || !message.status.length) {
        return onFail(new ghast.Error(ghast.ErrorCode.LOAD_MEDIA_FAILED));
      }

      const media = MediaSession.create(
        message.status[0],
        this.sessionId,
        this.transportId,
        this._device
      );

      this.media.push(media);
      this._loading--;

      if (onSuccess) onSuccess(media);
    };

    this._send(queueLoadRequest, onComplete, onFail, namespace, destination);
  }

  removeMediaListener(listener) {
    this._mediaListeners.delete(listener);
  }

  removeMessageListener(namespace, listener) {
    if (this._messageListeners.has(namespace)) {
      this._messageListeners.get(namespace).delete(listener);
    }

    this._device.removeListener(namespace, listener);
  }

  removeUpdateListener(listener) {
    this._updateListeners.delete(listener);
  }

  sendMessage(namespace, message, onSuccess, onError) {
    if (!namespace || typeof namespace !== 'string') {
      if (onError) onError(new ghast.Error(ghast.ErrorCode.INVALID_PARAMETER));
      return;
    }

    const destination = this.transportId;
    this._send(message, onSuccess, onError, namespace, destination);
  }

  setReceiverMuted(muted, onSuccess, onError) {
    const volume = new ghast.Volume(null, muted);
    const request = new ReceiverVolumeRequest(volume);

    request.sessionId = this.sessionId;
    request.expectedVolume = this.receiver.volume;

    this._send(request, onSuccess, onError, RECEIVER_NAMESPACE);
  }

  setReceiverVolumeLevel(level, onSuccess, onError) {
    const request = new ReceiverVolumeRequest(new ghast.Volume(level));
    request.sessionId = this.sessionId;
    request.expectedVolume = this.receiver.volume;

    this._send(request, onSuccess, onError, RECEIVER_NAMESPACE);
  }

  stop(onSuccess, onError) {
    const request = new ReceiverStopRequest(this.sessionId);

    const onComplete = () => {
      this._teardown();
      if (onSuccess) onSuccess();
    };

    this._send(request, onComplete, onError, RECEIVER_NAMESPACE);
  }

  _send(message, onSuccess, onError, namespace, destination = RECEIVER_ID) {
    if (!this._isInitialized || this.status !== ghast.SessionStatus.CONNECTED) {
      debug.session('Error sending message, session not ready/connected');
      if (onError) onError(new ghast.Error(ghast.ErrorCode.SESSION_ERROR));
      return;
    }

    this._device.send(message, namespace, destination, onSuccess, onError);
  }
}


/**
 * Internally ghast needs to manage some independent state, like running
 * a service discovery browser, a list of accessible devices, and whatever
 * apiConfig was given
 */
class State {
  constructor() {
    this.browser = null;
    this.devices = [];
    this.session = null;
    this.apiConfig = null;
  }

  findDevices() {
    this.browser = new dnssd.Browser(dnssd.tcp('googlecast'))
      .on('serviceUp', service => this.addDevice(service))
      .on('serviceDown', service => this.removeDevice(service))
      .start();
  }

  stop() {
    debug.state('Stopping State...');
    this.browser.stop();
    this.devices.forEach(d => d.stop());
  }

  /**
   * Add new devices to the list, announce w/ recieverListeners, and
   * auto-connect to the device if it is already running the application.
   *
   * auto-connect only:
   * - not currently connected to a session
   * - not in the middle of a `requstSession()`
   * - autojoin policy is ok with it
   */
  addDevice(service) {
    // on add new devices:
    if (this.devices.find(d => d.id === service.txt.id)) return;

    const address = service.addresses[0];
    const device = new Device(address, service.port, service.txt);

    debug.state(`Found new device: '${device.name}' @ ${device.address}`);
    this.devices.push(device);

    const fn = this.apiConfig && this.apiConfig.receiverListener;
    const notify = () => fn && fn(ghast.ReceiverAvailability.AVAILABLE, device);

    if (this.session) {
      debug.state('┖─ Active session, skipping auto connect');
      return notify();
    }

    if (this.requesting) {
      debug.state('┖─ Mid requestSession(), skipping auto connect');
      return notify();
    }

    if (!this.apiConfig) {
      debug.state('┖─ No apiConfig yet, skipping auto connect');
      return notify();
    }

    if (this.apiConfig.autoJoinPolicy === ghast.AutoJoinPolicy.PAGE_SCOPED) {
      debug.state('┖─ Page scoped auto-join policy, skipping auto connect');
      return notify();
    }

    if (typeof this.apiConfig.sessionListener !== 'function') {
      debug.state('┖─ No sessionListener, skipping auto connect');
      return notify();
    }

    // check a status message to see if we can connect to that device
    const checkDevice = (message) => {
      const appId = this.apiConfig.sessionRequest.appId;

      if (this.session) {
        debug.state('A session appeared min-autoconnect, stopping');
        device.stop();
        return;
      }

      if (_.get(message, 'status.applications[0].appId') !== appId) {
        debug.state('Device doesnt match appId, stopping');
        device.stop();
        return;
      }

      debug.state('Found existing session, connecting...');
      this.session = Session.create(message, device);

      try {
        this.apiConfig.sessionListener(this.session);
      } catch (err) {
        setTimeout(() => {
          console.log('Error in apiConfig.sessionListener: ');
          throw err;
        });
      }
    };

    device.start()
      .then(() => this.getReceiverStatus(device))
      .then(checkDevice, () => device.stop())
      .then(notify);
  }

  removeDevice(service) {
    const index = this.devices.find(d => d.id === service.txt.id);

    if (index !== -1) {
      const device = this.devices[index];
      this.devices.splice(index, 1);

      if (this.apiConfig && this.apiConfig.receiverListener) {
        this.apiConfig.receiverListener(
          ghast.ReceiverAvailability.UNAVAILABLE,
          device
        );
      }
    }
  }

  getReceiverStatus(device) {
    const request = new ReceiverStatusRequest();
    const namespace = RECEIVER_NAMESPACE;
    const destination = RECEIVER_ID;

    return new Promise((resolve, reject) => {
      device.send(request, namespace, destination, resolve, reject);
    });
  }

  getSessionFromDevices(sessionId) {
    // get the first resolving promise from items/promise
    const getFirst = (items, fn) =>
      items.map(i => fn.bind(null, i))
           .reduce((acc, promise) => acc.catch(promise), Promise.reject());

    // resolves to a session from the first device that matches sessionId
    // or gets rejected if no matches are found
    return getFirst(this.devices, device =>
      device.start()
        .then(() => this.getReceiverStatus(device))
        .then((msg) => {
          if (_.get(msg, 'status.applications[0].sessionId') !== sessionId) {
            device.stop();
            return Promise.reject();
          }

          debug.state('Found existing session, connecting...');
          this.session = Session.create(msg, device);

          return this.session;
        }));
  }

  connect(device, onSuccess, onError, opt_sessionRequest) {
    // prevent concurrent requests:
    if (this.requesting) {
      return onError && onError(new ghast.Error(ghast.ErrorCode.SESSION_ERROR));
    }

    this.requesting = true;

    const appId = (!!opt_sessionRequest)
      ? opt_sessionRequest.appId
      : this.apiConfig.sessionRequest.appId;

    const getSession = (message) => {
      if (_.get(message, 'status.applications[0].appId') !== appId) {
        return this.startSession(device, appId);
      }

      debug.state('Found existing session, connecting...');
      return Session.create(message, device);
    };

    const handleSuccess = (session) => {
      this.session = session;
      this.requesting = false;

      try {
        onSuccess && onSuccess(session);
      } catch (err) {
        setTimeout(() => {
          console.log('Error in ghast.requestSession onSuccess:');
          throw err;
        });
      }
    };

    const handleError = (err) => {
      this.requesting = false;
      onError && onError(err);
    };

    device.start()
      .then(() => this.getReceiverStatus(device))
      .then(getSession)
      .then(handleSuccess, handleError);
  }

  startSession(device, appId) {
    return new Promise((resolve, reject) => {
      const request = new AppLaunchRequest(appId);
      const onSuccess = msg => resolve(Session.create(msg, device));

      device.send(request, RECEIVER_NAMESPACE, RECEIVER_ID, onSuccess, reject);
    });
  }
}


/**
 * holds needed internal state
 */
let state = null;


ghast.Session = Session;
ghast.media.Media = MediaSession;


ghast.initialize = function(apiConfig, onSuccess, _onError) {
  if (state) state.stop();
  state = new State();
  state.apiConfig = apiConfig; // @TODO: verify api config

  ghast.devices = state.devices;
  state.findDevices();
  onSuccess();

  // wait 2s to find devices. if none are found, fire a receiverListener
  setTimeout(() => {
    if (
      !!this.devices.length &&
      this.apiConfig &&
      this.apiConfig.receiverListener
    ) {
      this.apiConfig.receiverListener(ghast.ReceiverAvailability.UNAVAILABLE);
    }
  }, 2000);
};


ghast.requestSession = function(onSuccess, onError, opt_sessionRequest, device) {
  // Idk if anyone actually uses opt_sessionRequest, so I'm doing some
  // override swapping to allow this: requestSession(fn, fn, device);
  if (opt_sessionRequest instanceof Device) {
    device = opt_sessionRequest;
    opt_sessionRequest = null;
  }

  const selected = device || state.devices[0];

  if (!selected) {
    return onError && onError(new ghast.Error(ghast.ErrorCode.RECEIVER_UNAVAILABLE));
  }

  if (!(selected instanceof Device)) {
    return onError && onError(new ghast.Error(ghast.ErrorCode.INVALID_PARAMETER));
  }

  state.connect(selected, onSuccess, onError, opt_sessionRequest);
};


ghast.requestSessionById = function(sessionId) {
  if (!sessionId || !this.apiConfig) return;

  state.getSessionFromDevices(sessionId).then((session) => {
    this.apiConfig.sessionListener(session);
  });
};


/**
 * Extra property, a list of currently discovered devices.
 * Gets updated as devices are found/lost.
 */
ghast.devices = [];

/**
 * Stops the zeroconf browser and severs all device connections
 */
ghast.stop = function() {
  if (state) state.stop();
};


module.exports = ghast;

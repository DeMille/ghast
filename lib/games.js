const _ = require('lodash');

const debug = require('./debug')('ghast:games');

const GAMES_NAMESPACE = 'urn:x-cast:com.google.cast.games';

const REQUEST_TYPE = {
  AVAILABLE: 1,
  READY    : 2,
  IDLE     : 3,
  PLAYING  : 4,
  QUIT     : 5,
  REQUEST  : 6,
  MESSAGE  : 7,
  CONNECT  : 1100,
};


// namespace
const games = {};

// enumerated values
games.GameManagerErrorCode = {
  INVALID_REQUEST  : 'invalid_request',
  NOT_ALLOWED      : 'not_allowed',
  INCORRECT_VERSION: 'incorrect_version',
  TOO_MANY_PLAYERS : 'too_many_players',
};

games.GameManagerEventType = {
  STATE_CHANGED        : 'state_changed',
  GAME_MESSAGE_RECEIVED: 'game_message_received',
};

games.GameplayState = {
  UNKNOWN            : 0,
  LOADING            : 1,
  RUNNING            : 2,
  PAUSED             : 3,
  SHOWING_INFO_SCREEN: 4,
};

games.LobbyState = {
  UNKNOWN: 0,
  OPEN   : 1,
  CLOSED : 2,
};

games.PlayerState = {
  UNKNOWN  : 0,
  DROPPED  : 1,
  QUIT     : 2,
  AVAILABLE: 3,
  READY    : 4,
  IDLE     : 5,
  PLAYING  : 6,
};


class GameManagerError {
  constructor(errorCode, errorDescription, result, castError) {
    this.castError = castError;
    this.errorCode = errorCode;
    this.errorDescription = errorDescription;
    this.result = result;
  }
}

/**
 * just an interface, not meant to be used directly
 */
class GameManagerEvent { }

class GameManagerGameMessageReceivedEvent {
  constructor(playerId, gameMessage) {
    this.gameMessage = gameMessage;
    this.playerId = playerId;
    this.type = games.GameManagerEventType.GAME_MESSAGE_RECEIVED;
  }
}

class GameManagerInstanceResult {
  constructor(gameManagerClient) {
    this.gameManagerClient = gameManagerClient;
  }
}


class GameManagerResult {
  constructor(playerId, requestId, extraMessageData) {
    this.extraMessageData = extraMessageData;
    this.playerId = playerId;
    this.requestId = requestId;
  }
}

class GameManagerStateChangedEvent {
  constructor(currentState, previousState) {
    this.currentState = currentState;
    this.previousState = previousState;
    this.type = games.GameManagerEventType.STATE_CHANGED;
  }
}

games.GameManagerError = GameManagerError;
games.GameManagerEvent = GameManagerEvent;
games.GameManagerGameMessageReceivedEvent = GameManagerGameMessageReceivedEvent;
games.GameManagerInstanceResult = GameManagerInstanceResult;
games.GameManagerResult = GameManagerResult;
games.GameManagerStateChangedEvent = GameManagerStateChangedEvent;


class PlayerInfo {
  constructor(playerId, playerState, playerData, isControllable) {
    this._id    = playerId;
    this._state = playerState;
    this._data  = playerData;
    this._ctrl  = isControllable;
  }

  equals(otherPlayer) {
    return !!otherPlayer &&
           otherPlayer._id === this._id &&
           otherPlayer._state === this._state &&
           otherPlayer._ctrl === this._ctrl &&
           _.isEqual(otherPlayer._data, this._data);
  }

  getPlayerData() {
    return this._data;
  }

  getPlayerId() {
    return this._id;
  }

  getPlayerState() {
    return this._state;
  }

  isConnected() {
    return this._state === games.PlayerState.IDLE ||
           this._state === games.PlayerState.AVAILABLE ||
           this._state === games.PlayerState.PLAYING ||
           this._state === games.PlayerState.READY;
  }

  isControllable() {
    return this._ctrl;
  }
}


/**
 * Immutable! Represents a snapshot of state
 */
class GameManagerState {
  constructor(
    applicationName,
    maxPlayers,
    lobbyState,
    gameplayState,
    gameData,
    gameStatusText,
    players
  ) {
    this._name           = applicationName;
    this._maxPlayers     = maxPlayers;
    this._lobbyState     = lobbyState;
    this._gameplayState  = gameplayState;
    this._gameData       = gameData;
    this._gameStatusText = gameStatusText;
    this._players        = players; // PlayerInfo's
  }

  equals(otherState) {
    return !!otherState &&
           this._name === otherState._name &&
           this._maxPlayers === otherState._maxPlayers &&
           this._lobbyState === otherState._lobbyState &&
           this._gameplayState === otherState._gameplayState &&
           this._gameStatusText === otherState._gameStatusText &&
           _.isEqual(this._gameData === otherState._gameData) &&
           this._players.length === otherState._players.length &&
           !this.getListOfChangedPlayers(otherState).length;
  }

  getApplicationName() {
    return this._name;
  }

  getConnectedControllablePlayers() {
    return this._players.filter(p => p.isConnected() && p.isControllable());
  }

  getConnectedPlayers() {
    return this._players.filter(p => p.isConnected());
  }

  getControllablePlayers() {
    return this._players.filter(p => p.isControllable());
  }

  getGameData() {
    return this._gameData;
  }

  getGameplayState() {
    return this._gameplayState;
  }

  getGameStatusText() {
    return this._gameStatusText;
  }

  getListOfChangedPlayers(otherState) {
    // player ids that have been added, removed, or changed
    const changed = [];

    // map ids -> player
    const these = new Map();
    const those = new Map();

    this._players.forEach(p => those.set(p.getPlayerId(), p));
    otherState._players.forEach(p => those.set(p.getPlayerId(), p));

    these.forEach((player, id) => {
      if (!those.has(id) || !player.equals(those.get(id))) changed.push(id);
    });

    those.forEach((player, id) => {
      if (changed.indexof(id) !== -1) return; // prevent duplicates
      if (!these.has(id) || !player.equals(these.get(id))) changed.push(id);
    });

    return changed;
  }

  getLobbyState() {
    return this._lobbyState;
  }

  getMaxPlayers() {
    return this._maxPlayers;
  }

  getPlayer(playerId) {
    return _.find(this._players, p => p.getPlayerId() === playerId) || null;
  }

  getPlayers() {
    return this._players;
  }

  getPlayersInState(playerState) {
    return this._players.filter(p => p.getPlayerState() === playerState);
  }

  hasGameDataChanged(otherState) {
    return !_.isEqual(otherState._gameData, this._gameData);
  }

  hasGameplayStateChanged(otherState) {
    return otherState._gameplayState !== this._gameplayState;
  }

  hasGameStatusTextChanged(otherState) {
    return otherState._gameStatusText !== this._gameStatusText;
  }

  hasLobbyStateChanged(otherState) {
    return otherState._lobbyState !== this._lobbyState;
  }

  hasPlayerChanged(playerId, otherState) {
    const A = this.getPlayer(playerId);
    const B = otherState.getPlayer(playerId);

    if (!A && !B) return false; // neither player existed (no change)
    if (!A || !B) return true;  // one player was removed from state

    return !A.equals(B);
  }

  hasPlayerDataChanged(playerId, otherState) {
    const A = this.getPlayer(playerId);
    const B = otherState.getPlayer(playerId);

    if (!A && !B) return false; // neither player existed (no change)
    if (!A || !B) return true;  // one player was removed from state

    return A.getPlayerState() !== B.getPlayerState();
  }

  hasPlayerStateChanged(playerId, otherState) {
    const A = this.getPlayer(playerId);
    const B = otherState.getPlayer(playerId);

    if (!A && !B) return false; // neither player existed (no change)
    if (!A || !B) return true;  // one player was removed from state

    return !_.isEqual(A.getPlayerData(), B.getPlayerData());
  }
}


let _id = 0;
const uniqueID = () => ++_id;

/**
 * A wrapper constructor for GameManagerClient messages
 */
class ClientRequest {
  constructor(type, playerId, token, extraMessageData) {
    this.requestId        = uniqueID();
    this.type             = type;
    this.playerId         = playerId;
    this.playerToken      = token;
    this.extraMessageData = extraMessageData;
  }
}


class GameManagerClient {
  constructor(session) {
    this._session    = session;
    this._isDisposed = false;
    this._name       = null;
    this._maxPlayers = null;
    this._handler    = null;
    this._tokens     = new Map();
    this._listeners  = new Map();

    // We need to check each incoming message to update game state and we also
    // need to fire onSuccess callbacks when/if they are provided. Callbacks
    // are added here, keyed by requestId, so they can be fired AFTER a message
    // has been received/processed.
    this._callbacks = new Map();

    // keep current game state updated, hold previous to check if updated
    this._current = null;
    this._previous = null;
  }

  // need to make instance, add listener, send connect message
  static getInstanceFor(session, onSuccess, onError) {
    const client = new GameManagerClient(session);

    // @TODO: need to make sure that the response to this request has a requestId,
    // otherwise this handler wont ever fire.
    const onComplete = () => {
      if (onSuccess) {
        onSuccess(new GameManagerInstanceResult(client));
      }
    };

    client._handler = client._onMessage.bind(client);
    client._session.addMessageListener(GAMES_NAMESPACE, client._handler);

    client._send(REQUEST_TYPE.CONNECT, null, null, onComplete, onError);
  }

  _emit(event) {
    (this._listeners.get(event.type) || []).forEach(fn => fn(event));
  }

  /**
   * type is always defined, all others might be undefined/null
   *
   * playerId is required for all requests except:
   * - REQUEST_TYPE.CONNECT (independent of player)
   * - REQUEST_TYPE.AVAILABLE (sendPlayerAvailableRequest can register a new player)
   */
  _send(type, id, extraMessageData, onSuccess, onError) {
    const playerId = id || this._lastPlayerId; // might be undefined

    if (this._isDisposed) {
      throw new Error('GameManagerClient has been disposed, cant send request');
    }

    if (!playerId && type !== REQUEST_TYPE.AVAILABLE && type !== REQUEST_TYPE.CONNECT) {
      throw new Error('No playerId given or no previous playerId was found');
    }

    const token = this._tokens.get(playerId); // might be undefined
    const request = new ClientRequest(type, playerId, token, extraMessageData);

    // hold onto callbacks to get handled below. responses will have the same ID
    if (onSuccess || onError) {
      this._callbacks.set(request.requestId, {onSuccess, onError});
    }

    // session.sendMessage needs an error handler too, in case something goes wrong
    // with sending. any resulting error needs to be wrapped in a GameManagerError
    const errorHandler = (err) => {
      debug('Error sending game client message', err);
      this._callbacks.delete(request.requestId);

      if (onError) {
        onError(new GameManagerError(err.code, err.description, null, err));
      }
    };

    this._session.sendMessage(GAMES_NAMESPACE, request, null, errorHandler);
  }

  _onMessage(namespace, payload) {
    let msg;

    try {
      msg =  JSON.parse(payload);
    } catch (err) {
      throw new Error('Error parsing game manager message payload: ' + payload);
    }

    const result = new GameManagerResult(
      msg.playerId,
      msg.requestId,
      msg.extraMessageData
    );

    // retrieve any callbacks (and remove their references)
    const { onSuccess, onError } = this._callbacks.get(msg.requestId) || {};
    this._callbacks.delete(msg.requestId);

    // check response for errors, like too many players
    if (msg.statusCode !== 0) {
      if (onError) {
        onError(new GameManagerError(msg.statusCode, msg.errorDescription, result));
      }

      return debug('Error response: %s', msg.errorDescription);
    }

    // update name/maxPlayers if given a config:
    if (msg.gameManagerConfig) {
      this._name = msg.gameManagerConfig.applicationName;
      this._maxPlayers = msg.gameManagerConfig.maxPlayers;
    }

    // requestId will only be set if the message was a direct
    // response to a previous request sent by this client
    if (msg.requestId && msg.playerId) {
      this._lastPlayerId = msg.playerId;
    }

    if (msg.playerId && msg.playerToken) {
      this._tokens.set(msg.playerId, msg.playerToken);
    }

    const isControllable = player => this._tokens.has(player.playerId);

    const players = msg.players.map(p => new PlayerInfo(
      p.playerId, p.playerState, p.playerData, isControllable(p)));

    // create new state, set this.current, push old to this.previous
    const state = new GameManagerState(
      this._name,
      this._maxPlayers,
      msg.lobbyState,
      msg.gameplayState,
      msg.gameData,
      msg.gameStatusText,
      players
    );

    this._previous = this._current;
    this._current = state;

    // do success callback (seems to be BEFORE events are emitted)
    if (onSuccess) onSuccess(result);

    // emit message received event
    // in this case, the extraMessageData is the game message
    if (msg.type === 2 && this._tokens.has(p.playerId)) {
      this._emit(new GameManagerGameMessageReceivedEvent(
        msg.playerId,
        msg.extraMessageData
      ));
    }

    // emit game state changed event
    if (!this._current.equals(this._previous)) {
      this._emit(new GameManagerStateChangedEvent(this._current, this._previous));
    }
  }

  addEventListener(type, listener) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }

    this._listeners.get(type).add(listener);
  }

  dispose() {
    this._isDisposed = true;
    this._listeners.clear();
    this._callbacks.clear();
    this._session.removeMessageListener(GAMES_NAMESPACE, this._handler);
  }

  getCurrentState() {
    if (this._isDisposed) throw new Error('GameManagerClient has been disposed');
    return this._current;
  }

  getLastUsedPlayerId() {
    if (this._isDisposed) throw new Error('GameManagerClient has been disposed');
    return this._lastPlayerId;
  }

  isDisposed() {
    return this._isDisposed;
  }

  removeEventListener(type, listener) {
    if (this._listeners.has(type)) {
      this._listeners.get(type).delete(listener);
    }
  }

  sendGameMessage(data) {
    this._send(REQUEST_TYPE.MESSAGE, null, data);
  }

  sendGameMessageWithPlayerId(playerId, data) {
    this._send(REQUEST_TYPE.MESSAGE, playerId, data);
  }

  sendGameRequest(data, onSuccess, onError) {
    this._send(REQUEST_TYPE.REQUEST, null, data, onSuccess, onError);
  }

  sendGameRequestWithPlayerId(playerId, data, onSuccess, onError) {
    this._send(REQUEST_TYPE.REQUEST, playerId, data, onSuccess, onError);
  }

  sendPlayerAvailableRequest(data, onSuccess, onError) {
    this._send(REQUEST_TYPE.AVAILABLE, null, data, onSuccess, onError);
  }

  sendPlayerAvailableRequestWithPlayerId(playerId, data, onSuccess, onError) {
    this._send(REQUEST_TYPE.AVAILABLE, playerId, data, onSuccess, onError);
  }

  sendPlayerIdleRequest(data, onSuccess, onError) {
    this._send(REQUEST_TYPE.IDLE, null, data, onSuccess, onError);
  }

  sendPlayerIdleRequestWithPlayerId(playerId, data, onSuccess, onError) {
    this._send(REQUEST_TYPE.IDLE, playerId, data, onSuccess, onError);
  }

  sendPlayerPlayingRequest(data, onSuccess, onError) {
    this._send(REQUEST_TYPE.PLAYING, null, data, onSuccess, onError);
  }

  sendPlayerPlayingRequestWithPlayerId(playerId, data, onSuccess, onError) {
    this._send(REQUEST_TYPE.PLAYING, playerId, data, onSuccess, onError);
  }

  sendPlayerQuitRequest(data, onSuccess, onError) {
    this._send(REQUEST_TYPE.QUIT, null, data, onSuccess, onError);
  }

  sendPlayerQuitRequestWithPlayerId(playerId, data, onSuccess, onError) {
    this._send(REQUEST_TYPE.QUIT, playerId, data, onSuccess, onError);
  }

  sendPlayerReadyRequest(data, onSuccess, onError) {
    this._send(REQUEST_TYPE.READY, null, data, onSuccess, onError);
  }

  sendPlayerReadyRequestWithPlayerId(playerId, data, onSuccess, onError) {
    this._send(REQUEST_TYPE.READY, playerId, data, onSuccess, onError);
  }
}


games.PlayerInfo = PlayerInfo;
games.GameManagerState = GameManagerState;
games.GameManagerClient = GameManagerClient;


module.exports = games;

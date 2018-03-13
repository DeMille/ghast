const ghast = require('./');


/**
 * General logic:
 *
 * - pick appId to connect to
 * - initialize API
 * - wait for devices to appear on the network
 * - or automatically connect to devices that are already casting your appId
 *
 * Then you can load media, play, pause, etc.
 */


// Use first argument or play Big Buck Bunny
const arg = process.argv[2];
const mediaURL = arg || 'http://commondatastorage.googleapis.com/gtv-videos-bucket/big_buck_bunny_1080p.mp4';
const posterURL = (arg) ? null : 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/424px-Big_buck_bunny_poster_big.jpg';

let activeSession = null;
let activeMedia = null;
const appID = ghast.media.DEFAULT_MEDIA_RECEIVER_APP_ID;

const apiConfig = new ghast.ApiConfig(
  new ghast.SessionRequest(appID),
  sessionListener,  // gets called when you auto-connect to an active session
  receiverListener, // gets called when devices go up / down
  ghast.AutoJoinPolicy.ORIGIN_SCOPED, // rules for auto-connecting
);

ghast.initialize(apiConfig, () => {
  console.log('Initialized. Now searching for devices...');
});


function receiverListener(availability, device) {
  // `receiverListener` called whenever a device is detached or none are found
  if (availability === ghast.ReceiverAvailability.UNAVAILABLE) {
    if (device) {
      console.log(`Receiver now gone: ${device.name} @ ${device.address}`);
      console.log(`(${ghast.devices.length} devices are still available)`);
    } else {
      console.log('No receivers are available');
    }
  // also called when a new device is found
  } else {
    console.log(`New receiver found: ${device.name} @ ${device.address}`);
    console.log(`(${ghast.devices.length} devices are available)`);

    if (!activeSession) launchApp(device);
  }
}


function sessionListener(session) {
  console.log('Found an active session, connecting');
  useSession(session);
}


/**
 * Launching an application on a device.
 *
 * The main difference between this and the chrome environment is the
 * `device` parameter on `requestSession`
 */
function launchApp(device) {
  console.log(`Launching app on ${device.name}`);

  const onSuccess = session => useSession(session);
  const onErr = err => console.log('Error launching app: ', err);

  ghast.requestSession(onSuccess, onErr, device);
}


function useSession(session) {
  console.log(`Connected to session: ${session.sessionId}`);
  activeSession = session;

  session.addMediaListener(mediaListener);
  session.addUpdateListener(onSessionUpdate);

  loadMedia(mediaURL, posterURL);
}


function onSessionUpdate(isAlive) {
  console.log('Session update event fired.');
  if (!isAlive) activeSession = null;
}


function loadMedia(url, poster) {
  if (!activeSession) {
    console.log("Can't load media, no active session");
    return;
  }

  console.log(`Loading media: ${url}`);

  const info = new ghast.media.MediaInfo(url);
  info.metadata = new ghast.media.GenericMediaMetadata();
  info.metadata.metadataType = ghast.media.MetadataType.GENERIC;
  info.contentType = 'video/mp4';
  info.metadata.title = 'ghast demo';
  info.metadata.images = [{ url: poster }];

  const request = new ghast.media.LoadRequest(info);
  request.autoplay = true;
  request.currentTime = 0;

  const onErr = err => console.log('Error loading media', err);

  activeSession.loadMedia(request, mediaListener, onErr);
}


function mediaListener(mediaSession) {
  console.log(`Connected to media session: ${mediaSession.mediaSessionId}`);
  activeMedia = mediaSession;

  const log = () => {
    console.log(`Active media details:
      playerState: ${mediaSession.playerState}
      currentTime: ${mediaSession.currentTime}
      duration: ${mediaSession.media.duration}
    `);
  };

  const listener = (isAlive) => {
    console.log('Media update event fired.');
    log();
    if (!isAlive) activeMedia = null;
  };

  log();
  mediaSession.addUpdateListener(listener);
}


function getMediaStatus() {
  if (!activeSession || !activeMedia) return;

  const onSuccess = isAlive => console.log('Got media update');
  const onError = err => console.log('Error: ', err);

  activeMedia.getStatus(null, onSuccess, onError);
}


function play() {
  if (!activeSession || !activeMedia) return;

  const onSuccess = () => console.log('Now playing');
  const onError = err => console.log('Error: ', err);

  activeMedia.play(null, onSuccess, onError);
}


function pause() {
  if (!activeSession || !activeMedia) return;

  const onSuccess = () => console.log('Now paused');
  const onError = err => console.log('Error: ', err);

  activeMedia.pause(null, onSuccess, onError);
}


function stop() {
  if (!activeSession || !activeMedia) return;

  const onSuccess = () => console.log('Now stopped');
  const onError = err => console.log('Error: ', err);

  activeMedia.stop(null, onSuccess, onError);
}


function setVolume(level = 1.0) {
  if (!activeSession || !activeMedia) return;

  const onSuccess = () => console.log('Volume set');
  const onError = err => console.log('Error: ', err);

  const volume = new ghast.Volume(level);
  const request = new ghast.media.VolumeRequest(volume);

  activeMedia.setVolume(request, onSuccess, onError);
}


function setMute(isMuted = false) {
  if (!activeSession || !activeMedia) return;

  const onSuccess = () => console.log('Mute set');
  const onError = err => console.log('Error: ', err);

  const volume = new ghast.Volume(null, isMuted);
  const request = new ghast.media.VolumeRequest(volume);

  activeMedia.setVolume(request, onSuccess, onError);
}

# ghast
#### An open implementation of the JavaScript Chromecast API

The goal of `ghast` is be to a drop in replacement for the [chrome sender API](https://developers.google.com/cast/docs/reference/chrome/).

You should be able to do a s/chrome.cast/ghast/g with existing chrome sender applications, port them to an electron environment, or (potentially 🤞) a firefox extension.

Status: WIP
- [x] chrome.cast.* - i.e., Session/MediaSession etc. all work
- [ ] chrome.cast.games - implemented, untested
- [ ] cast.framework - mostly implemented, completely untested

Still relatively usable provided you aren't using the more recent `cast.framework`.  
You can look an example w/ [sample.js](sample): `node sample.js [url]`

[sample]: https://github.com/DeMille/ghast/blob/master/sample.js

### Usage
```js
const ghast = require('ghast');

const apiConfig = new ghast.ApiConfig(
  new ghast.SessionRequest(appID),
  sessionListener,  // gets called when you auto-connect to an active session
  receiverListener, // gets called when devices go up / down
  ghast.AutoJoinPolicy.ORIGIN_SCOPED, // rules for auto-connecting
);

ghast.initialize(apiConfig, () => {
  console.log('Initialized. Now searching for devices...');
});

// ...
```

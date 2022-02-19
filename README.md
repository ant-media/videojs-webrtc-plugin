# videojs-antmedia-webrtc

Plugin for viewing streams located on the ant-media server. There is also a function to change the resolution of the stream

## Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Installation](#installation)
- [Usage](#usage)
  - [Options Object](#options-object)
    - [**streamUrl**](#streamurl)
    - [**iceServers**](#iceservers)
  - [`<script>` Tag](#script-tag)
  - [Browserify/CommonJS](#browserifycommonjs)
  - [RequireJS/AMD](#requirejsamd)
- [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->
## Installation

```sh
npm install --save videojs-antmedia-webrtc
```

## Usage

To include videojs-antmedia-webrtc on your website or web application, use any of the following methods.

### Options Object

#### **streamUrl** 
Websocket Ant-MediaServer address format:
```js
ws://[ant-address]/[app]/websocket?streamId=[streamId]&token=[token(opt)]&subscriberId=[subscriberId(opt)]&subscriberCode=[TOTP-code(opt)]
```
link example:
```js
wss://12.23.322.157:5080/LiveApp/websocket?streamId=test
```
parameters:
- streamId - Id of the stream published on the media server
- token (optional) - a one-time token generated for the stream (in case the stream is protected by the one-time token protection mechanism
- subscriberId (optional) - subscriber Id. Required if the stream is protected by a TOTP password
- subscriberCode (optional) - generated TOTP password. Required if the stream is protected by a TOTP password

#### **iceServers** 
Array of Ice-servers (STUN, TURN) in JSON string format to establish a WebRTC connection
example:
```js
"[ { "urls": "stun:stun1.l.google.com:19302" } ]"
```
### `<script>` Tag

This is the simplest case. Get the script in whatever way you prefer and include the plugin _after_ you include [video.js][videojs], so that the `videojs` global is available.

```html
<script src="//path/to/video.min.js"></script>
<script src="//path/to/videojs-antmedia-webrtc.min.js"></script>
<script>
  var player = videojs('my-video');

  player.antmediaWebrtc({
    streamUrl: "ws://[ant-address]/[app]/websocket?streamId=[streamId]",
    iceServers: "[ { "urls": "stun:stun1.l.google.com:19302" } ]",
  });
</script>
```

### Browserify/CommonJS

When using with Browserify, install videojs-antmedia-webrtc via npm and `require` the plugin as you would any other module.

```js
var videojs = require('video.js');

// The actual plugin function is exported by this module, but it is also
// attached to the `Player.prototype`; so, there is no need to assign it
// to a variable.
require('videojs-antmedia-webrtc');

var player = videojs('my-video');

player.antmediaWebrtc({
  streamUrl: "ws://[ant-address]/[app]/websocket?streamId=[streamId]",
  iceServers: "[ { "urls": "stun:stun1.l.google.com:19302" } ]",
});
```

### RequireJS/AMD

When using with RequireJS (or another AMD library), get the script in whatever way you prefer and `require` the plugin as you normally would:

```js
require(['video.js', 'videojs-antmedia-webrtc'], function(videojs) {
  var player = videojs('my-video');

  player.antmediaWebrtc({
    streamUrl: "ws://[ant-address]/[app]/websocket?streamId=[streamId]",
    iceServers: "[ { "urls": "stun:stun1.l.google.com:19302" } ]",
  });
});
```
## License

MIT. Copyright (c) ForaSoft


[videojs]: http://videojs.com/

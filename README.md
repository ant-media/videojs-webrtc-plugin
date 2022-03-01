# videojs-webrtc-plugin

Plugin for viewing streams located on the ant-media server. There is also a function to change the resolution of the stream

## Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Installation](#installation)
- [Usage](#usage)
  - [Options Object](#options-object)
    - [streamUrl](#streamurl)
    - [iceServers](#iceservers)
  - [`<script>` Tag](#script-tag)
  - [Browserify/CommonJS](#browserifycommonjs)
  - [RequireJS/AMD](#requirejsamd)
  - [Handling error-callbacks](#errors)
- [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->
## Installation

```sh
npm install --save videojs-webrtc-plugin
```

## Usage

To include videojs-webrtc-plugin on your website or web application, use any of the following methods.

### Options Object

#### **streamUrl** 
Ant-MediaServer stream address format:
```js
ws://[ant-address]/[app]/[streamId].webrtc?token=[token(opt)]&subscriberId=[subscriberId(opt)]&subscriberCode=[TOTP-code(opt)]
```
link example:
```js
wss://12.23.322.157:5080/LiveApp/stream1.webrtc
```
parameters:
- token (optional) - a one-time token generated for the stream (in case the stream is protected by the one-time token protection mechanism
- subscriberId (optional) - subscriber Id. Required if the stream is protected by a TOTP password
- subscriberCode (optional) - generated TOTP password. Required if the stream is protected by a TOTP password

#### **iceServers** 
Array of Ice-servers (STUN, TURN) in JSON string format to establish a WebRTC connection
example:
```js
'[ { "urls": "stun:stun1.l.google.com:19302" } ]'
```
### `<script>` Tag

This is the simplest case. Get the script in whatever way you prefer and include the plugin _after_ you include [video.js][videojs], so that the `videojs` global is available.

```html
<script src="//path/to/video.min.js"></script>
<script src="//path/to/videojs-webrtc-plugin.min.js"></script>
<script>
  var player = videojs('my-video');

  player.antmediaWebrtc({
    streamUrl: "ws://[ant-address]/[app]/[streamId].webrtc",
    iceServers: '[ { "urls": "stun:stun1.l.google.com:19302" } ]',
  });
</script>
```

### Browserify/CommonJS

When using with Browserify, install videojs-webrtc-plugin via npm and `require` the plugin as you would any other module.

```js
var videojs = require('video.js');

// The actual plugin function is exported by this module, but it is also
// attached to the `Player.prototype`; so, there is no need to assign it
// to a variable.
require('videojs-webrtc-plugin');

var player = videojs('my-video');

player.antmediaWebrtc({
  streamUrl: "ws://[ant-address]/[app]/[streamId].webrtc",
  iceServers: '[ { "urls": "stun:stun1.l.google.com:19302" } ]',
});
```

### RequireJS/AMD

When using with RequireJS (or another AMD library), get the script in whatever way you prefer and `require` the plugin as you normally would:

```js
require(['video.js', 'videojs-webrtc-plugin'], function(videojs) {
  var player = videojs('my-video');

  player.antmediaWebrtc({
    streamUrl: "ws://[ant-address]/[app]/[streamId].webrtc",
    iceServers: '[ { "urls": "stun:stun1.l.google.com:19302" } ]',
  });
});
```

### Handling error-callbacks 

Ant-MediaServer has functionality to handle errors coming from the backend.
To catch an error, you need to subscribe to the event "ant-error":

```js
<script src="//path/to/video.min.js"></script>
<script src="//path/to/videojs-webrtc-plugin.min.js"></script>
<script>
  var player = videojs('my-video');

  player.antmediaWebrtc({
    streamUrl: "ws://[ant-address]/[app]/[streamId].webrtc",
    iceServers: '[ { "urls": "stun:stun1.l.google.com:19302" } ]',
  });
  player.on('ant-error', function(event, errors) {
    console.log(errors);
  });
</script>
```
## License

MIT. Copyright (c) ForaSoft


[videojs]: http://videojs.com/

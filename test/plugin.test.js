import document from 'global/document';

import QUnit from 'qunit';
import sinon from 'sinon';
import videojs from 'video.js';

import plugin from '../src/plugin.js';

const STATIC_VIDEO_HTML = "<video id='video-player' class='video-js vjs-default-skin vjs-big-play-centered' controls playsinline></video>";

QUnit.test('the environment is sane', function(assert) {
  assert.strictEqual(typeof Array.isArray, 'function', 'es5 exists');
  assert.strictEqual(typeof sinon, 'object', 'sinon exists');
  assert.strictEqual(typeof videojs, 'function', 'videojs exists');
  assert.strictEqual(typeof plugin, 'object', 'plugin is a object');
});

QUnit.test('PeerConnection Config', function(assert) {

  const videoContainer = document.createElement('video_container');

  videoContainer.innerHTML = STATIC_VIDEO_HTML;

  document.getElementById('qunit-fixture').appendChild(videoContainer);

  const element = document.getElementById('video-player');

  assert.ok(element, 'Video Element is created');

  {
    const iceServer = '[ { "urls": "turn:ovh36.antmedia.io" } ]';

    const webrtcHandler = new plugin.WebRTCHandler(
      {
        src: 'ws://localhost:5080/WebRTCAppEE/stream.webrtc',
        type: 'video/webrtc',
        withCredentials: true,
        iceServers: iceServer,
        reconnect: false
      },
      null,
      {
        playerId: 'video-player'
      }
    );

    assert.deepEqual(webrtcHandler.webRTCAdaptor.peerconnection_config.iceServers, JSON.parse(iceServer), 'PeerConnection Config is correct');
  }

  {
    const iceServer2 = [
      { urls: 'turn:ovh36.antmedia.io' }
    ];
    const webrtcHandler2 = new plugin.WebRTCHandler(
      {
        src: 'ws://localhost:5080/WebRTCAppEE/stream.webrtc',
        type: 'video/webrtc',
        withCredentials: true,
        iceServers: [
          { urls: 'turn:ovh36.antmedia.io' }
        ],
        reconnect: false
      },
      null,
      {
        playerId: 'video-player'
      }
    );

    assert.deepEqual(webrtcHandler2.webRTCAdaptor.peerconnection_config.iceServers, iceServer2, 'PeerConnection Config is correct');
  }

  {

    // default iceServers
    const iceServer = [{
      urls: 'stun:stun1.l.google.com:19302'
    }];

    const webrtcHandler = new plugin.WebRTCHandler(
      {
        src: 'ws://localhost:5080/WebRTCAppEE/stream.webrtc',
        type: 'video/webrtc',
        withCredentials: true,
        reconnect: false
      },
      null,
      {
        playerId: 'video-player'
      }
    );

    assert.deepEqual(webrtcHandler.webRTCAdaptor.peerconnection_config.iceServers, iceServer, 'PeerConnection Config is correct');
  }

});

QUnit.module('videojs-webrtc-plugin', {

  beforeEach() {

    // Mock the environment's timers because certain things - particularly
    // player readiness - are asynchronous in video.js 5. This MUST come
    // before any player is created; otherwise, timers could get created
    // with the actual timer methods!
    this.clock = sinon.useFakeTimers();

    this.fixture = document.getElementById('qunit-fixture');
    this.video = document.createElement('video');
    this.fixture.appendChild(this.video);
    this.player = videojs(this.video);
  },

  afterEach() {
    this.player.dispose();
    this.clock.restore();
  }
});


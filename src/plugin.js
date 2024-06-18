import videojs from 'video.js';
import {ANT_CALLBACKS} from './const/CALLBACKS';
import ResolutionMenuButton from './components/ResolutionMenuButton';
import ResolutionMenuItem from './components/ResolutionMenuItem';
import { WebRTCAdaptor } from '@antmedia/webrtc_adaptor';

// Default options for the plugin.
const defaults = {
  sdpConstraints: { OfferToReceiveAudio: true, OfferToReceiveVideo: true },
  mediaConstraints: { video: false, audio: false }
};

// const Component = videojs.getComponent('Component');
/**
 * An advanced Video.js plugin for playing WebRTC stream from Ant Media Server
 *
 * Test Scenario #1
 * 1. Publish a stream from a WebRTC endpoint to Ant Media Server
 * 2. Play the stream with WebRTC
 * 3. Restart publishing the stream
 * 4. It should play automatically
 *
 * Test Scenario #2
 * 1. Publish a stream from a WebRTC endpoint to Ant Media Server
 * 2. Let the server return error(highresourceusage, etc.)
 * 3. WebSocket should be disconnected and play should try again
 *
 * Test Scenario #3
 * 1. Show error message if packet lost and jitter and RTT is high
 */
class WebRTCHandler {

  /**
   * Create a WebRTC source handler instance.
   *
   * @param  {Object} source
   *         Source object that is given in the DOM, includes the stream URL
   *
   * @param  {Object} [options]
   *         Options include:
   *            ICE Server
   *            Tokens
   *            Subscriber ID
   *            Subscriber code
   */
  constructor(source, tech, options) {
    this.player = videojs(options.playerId);

    if (!this.player.hasOwnProperty('sendDataViaWebRTC')) {
      Object.defineProperty(this.player, 'sendDataViaWebRTC', {
        value: (data) => {
          this.webRTCAdaptor.sendData(this.source.streamName, data);
        }
      });
    }

    this.isPlaying = false;
    this.disposed = false;

    this.initiateWebRTCAdaptor(source, options);
    this.player.ready(() => {
      this.player.addClass('videojs-webrtc-plugin');
    });
    this.player.on('playing', () => {
      if (this.player.el().getElementsByClassName('vjs-custom-spinner').length) {
        this.player.el().removeChild(this.player.spinner);
      }
    });

    videojs.registerComponent('ResolutionMenuButton', ResolutionMenuButton);
    videojs.registerComponent('ResolutionMenuItem', ResolutionMenuItem);
  }
  /**
   * Initiate WebRTCAdaptor.
   *
   * @param  {Object} [options]
   * An optional options object.
   *
   */
  initiateWebRTCAdaptor(source, options) {

    this.options = videojs.mergeOptions(defaults, options);
    this.source = source;

    if (typeof source.iceServers === 'object') {
      this.source.pcConfig = { iceServers: source.iceServers };
    } else if (typeof source.iceServers === 'string') {
      this.source.pcConfig = { iceServers: JSON.parse(source.iceServers) };
    }

    // replace the stream name with websocket url
    this.source.mediaServerUrl = source.src.replace(source.src.split('/').at(-1), 'websocket');
    // get the stream name from the url
    this.source.streamName = source.src.split('/').at(-1).split('.webrtc')[0];

    this.source.token = this.getUrlParameter('token');
    this.source.subscriberId = this.getUrlParameter('subscriberId');
    this.source.subscriberCode = this.getUrlParameter('subscriberCode');
    this.source.reconnect = this.source.reconnect === undefined ? true : this.source.reconnect;

    const config = {
      websocketURL: this.source.mediaServerUrl,
      mediaConstraints: this.source.mediaConstraints,

      isPlayMode: true,
      sdpConstraints: this.source.sdpConstraints,
      reconnectIfRequiredFlag: this.source.reconnect,

      callback: (info, obj) => {
        if (this.disposed) {
          return;
        }
        this.player.trigger('webrtc-info', { obj, info });
        switch (info) {
        case ANT_CALLBACKS.INITIALIZED: {
          this.play();
          break;
        }
        case ANT_CALLBACKS.ICE_CONNECTION_STATE_CHANGED: {

          break;
        }
        case ANT_CALLBACKS.PLAY_STARTED: {
          this.joinStreamHandler(obj);
          this.isPlaying = true;
          this.player.trigger('play');
          break;
        }
        case ANT_CALLBACKS.PLAY_FINISHED: {
          this.leaveStreamHandler(obj);
          this.isPlaying = false;
          this.player.trigger('ended');
          break;
        }
        case ANT_CALLBACKS.STREAM_INFORMATION: {
          this.streamInformationHandler(obj);
          break;
        }
        case ANT_CALLBACKS.RESOLUTION_CHANGE_INFO: {
          this.resolutionChangeHandler(obj);
          break;
        }
        case ANT_CALLBACKS.DATA_RECEIVED: {
          this.player.trigger('webrtc-data-received', { obj });
          break;
        }
        case ANT_CALLBACKS.DATACHANNEL_NOT_OPEN: {
          break;
        }
        case ANT_CALLBACKS.NEW_TRACK_AVAILABLE: {
          const vid = this.player.tech().el();

          if (vid.srcObject !== obj.stream) {
            vid.srcObject = obj.stream;
          }
          break;
        }
        }
      },
      callbackError: (error) => {

        if (this.disposed) {
          return;
        }
        // some of the possible errors, NotFoundError, SecurityError,PermissionDeniedError
        const ModalDialog = videojs.getComponent('ModalDialog');

        if (this.errorModal) {
          this.errorModal.close();
        }
        this.errorModal = new ModalDialog(this.player, {
          content: `ERROR: ${JSON.stringify(error)}`,
          temporary: true,
          pauseOnOpen: false,
          uncloseable: true
        });
        this.player.addChild(this.errorModal);
        this.errorModal.open();
        this.errorModal.setTimeout(() => this.errorModal.close(), 3000);
        this.player.trigger('webrtc-error', { error });

      }
    };

    if (this.source.pcConfig) {
      /* eslint-disable camelcase */
      const peerconnection_config = {};

      Object.assign(peerconnection_config, this.source.pcConfig);

      Object.assign(config, { peerconnection_config });
    }
    this.webRTCAdaptor = new WebRTCAdaptor(config);
  }

  /**
   * after websocket success connection.
   */
  play() {
    this.webRTCAdaptor.play(
      this.source.streamName,
      this.source.token,
      null,
      null,
      this.source.subscriberId,
      this.source.subscriberCode,
      null
    );

  }
  /**
   * after joined stream handler
   *
   * @param {Object} obj callback artefacts
   */
  joinStreamHandler(obj) {
    this.webRTCAdaptor.getStreamInfo(this.source.streamName);
  }
  /**
   * after left stream.
   */
  leaveStreamHandler() {
    // reset stream resolutions in dropdown
    this.player.resolutions = [];
    this.player.controlBar.getChild('ResolutionMenuButton').update();
  }
  /**
   * stream information handler.
   *
   * @param {Object} obj callback artefacts
   */
  streamInformationHandler(obj) {
    const streamResolutions = obj.streamInfo.reduce((unique, item) =>
      unique.includes(item.streamHeight) ? unique : [...unique, item.streamHeight], []).sort((a, b) => b - a);

    this.player.resolutions = streamResolutions.map((resolution) => ({
      label: resolution,
      value: resolution
    }));
    this.player.selectedResolution = 0;
    this.addResolutionButton();
  }
  addResolutionButton() {
    const controlBar = this.player.controlBar;
    const fullscreenToggle = controlBar.getChild('fullscreenToggle').el();

    if (controlBar.getChild('ResolutionMenuButton')) {
      controlBar.removeChild('ResolutionMenuButton');
    }

    controlBar.el().insertBefore(controlBar.addChild('ResolutionMenuButton', {
      plugin: this,
      streamName: this.source.streamName
    }).el(), fullscreenToggle);
  }
  /**
   * change resolution handler.
   *
   * @param {Object} obj callback artefacts
   */
  resolutionChangeHandler(obj) {
    // eslint-disable-next-line no-undef
    this.player.spinner = document.createElement('div');

    this.player.spinner.className = 'vjs-custom-spinner';
    this.player.el().appendChild(this.player.spinner);
    this.player.pause();
    this.player.setTimeout(() => {
      if (this.player.el().getElementsByClassName('vjs-custom-spinner').length) {
        this.player.el().removeChild(this.player.spinner);
        this.player.play();
      }
    }, 2000);
  }
  changeStreamQuality(value) {
    this.webRTCAdaptor.forceStreamQuality(this.source.streamName, value);
    this.player.selectedResolution = value;
    this.player.controlBar.getChild('ResolutionMenuButton').update();

  }

  /**
   * get url parameter
   *
   * @param {string} param callback event info
   */
  getUrlParameter(param) {
    if (this.source.src.includes('?')) {
      const urlParams = this.source.src.split('?')[1].split('&').reduce(
        (p, e) => {
          const a = e.split('=');

          p[decodeURIComponent(a[0])] = decodeURIComponent(a[1]);
          return p;
        },
        {}
      ) || {};

      return urlParams[param];
    }
    return null;
  }

  dispose() {
    this.disposed = true;
    if (this.webRTCAdaptor) {
      this.webRTCAdaptor.stop(this.source.streamName);
      this.webRTCAdaptor.closeWebSocket();
      this.webRTCAdaptor = null;
    }
  }
}

const webRTCSourceHandler = {
  name: 'videojs-webrtc-plugin',
  VERSION: '1.1',

  canHandleSource(srcObj, options = {}) {
    const localOptions = videojs.mergeOptions(videojs.options, options);

    localOptions.source = srcObj.src;

    return webRTCSourceHandler.canPlayType(srcObj.type, localOptions);
  },
  handleSource(source, tech, options = {}) {
    const localOptions = videojs.mergeOptions(videojs.options, options);

    // setting the src already dispose the component, no need to dispose it again
    tech.webrtc = new WebRTCHandler(source, tech, localOptions);

    return tech.webrtc;
  },

  canPlayType(type, options = {}) {

    const mediaUrl = options.source;
    const regex = /\.webrtc.*$/;
    const isMatch = regex.test(mediaUrl);

    if (isMatch) {
      return 'maybe';
    }

    return '';
  }
};

// register source handlers with the appropriate techs
videojs.getTech('Html5').registerSourceHandler(webRTCSourceHandler, 0);

export default
{
  WebRTCHandler,
  webRTCSourceHandler
};

import videojs from 'video.js';
import {WebRTCAdaptor} from './webrtc_adaptor';
import {ANT_CALLBACKS} from './const/CALLBACKS';
import {ANT_ERROR_CALLBACKS} from './const/ERROR_CALLBACKS';
import ResolutionMenuButton from './components/ResolutionMenuButton';
import ResolutionMenuItem from './components/ResolutionMenuItem';

// Default options for the plugin.
const defaults = {
  sdpConstraints: { OfferToReceiveAudio: true, OfferToReceiveVideo: true },
  mediaConstraints: { video: false, audio: false }
};
/**
 * An advanced Video.js plugin for playing WebRTC stream from Ant-mediaserver
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
    let iceConnected = false;

    this.options = videojs.mergeOptions(defaults, options);
    this.source = source;

    this.source.pcConfig = { iceServers: JSON.parse(source.iceServers) };
    this.source.mediaServerUrl = `${source.src.split('/').slice(0, 4).join('/')}/websocket`;
    this.source.streamName = source.src.split('/')[4].split('.webrtc')[0];

    this.source.token = this.getUrlParameter('token');
    this.source.subscriberId = this.getUrlParameter('subscriberId');
    this.source.subscriberCode = this.getUrlParameter('subscriberCode');

    this.webRTCAdaptor = new WebRTCAdaptor({
      websocketUrl: this.source.mediaServerUrl,
      mediaConstraints: this.source.mediaConstraints,
      pcConfig: this.source.pcConfig,
      sdpConstraints: this.source.sdpConstraints,
      player: this.player,
      callback: (info, obj) => {
        this.player.trigger('webrtc-info', { obj, info });
        switch (info) {
        case ANT_CALLBACKS.INITIALIZED: {
          this.initializedHandler();
          break;
        }
        case ANT_CALLBACKS.ICE_CONNECTION_STATE_CHANGED: {
          if (obj.state === 'connected' || obj.state === 'completed') {
            iceConnected = true;
          }
          break;
        }
        case ANT_CALLBACKS.PLAY_STARTED: {
          this.joinStreamHandler(obj);
          break;
        }
        case ANT_CALLBACKS.PLAY_FINISHED: {
          this.leaveStreamHandler(obj);
          //  if play_finished event is received, it has two meanings
          //  1.stream is really finished
          //  2.ice connection cannot be established and server reports play_finished event
          //  check that publish may start again
          if (iceConnected) {
            //  webrtc connection was successful and try to play again with webrtc
            setTimeout(function() {
              this.streamInformationHandler(obj);
            }, 3000);
          }
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
        }
      },
      callbackError: (error) => {
        if (error.name === ANT_ERROR_CALLBACKS.HIGH_RESOURCE_USAGE) {
          // disconnect when server reports high resource usage
          // it will fire the "closed" callback and and it'll reconnect again.
          // this is important when it's auto-scaling in the backend
          this.webRTCAdaptor.closeWebSocket();
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
    });
  }
  /**
   * after websocket success connection.
   */
  initializedHandler() {
    this.webRTCAdaptor.play(
      this.source.streamName,
      this.source.token,
      this.source.subscriberId,
      this.source.subscriberCode
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

    // Register the plugin to source handler tech
    tech.webrtc = new WebRTCHandler(source, tech, localOptions);

    return tech.webrtc;
  },

  canPlayType(type, options = {}) {

    const mediaUrl = options.source;

    if (mediaUrl.split('/')[4].includes('.webrtc')) {
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

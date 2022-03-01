import videojs from 'video.js';
import {version as VERSION} from '../package.json';
import {WebRTCAdaptor} from './webrtc_adaptor';
import {ANT_CALLBACKS} from './const/CALLBACKS';
import ResolutionMenuButton from './components/ResolutionMenuButton';
import ResolutionMenuItem from './components/ResolutionMenuItem';

const Plugin = videojs.getPlugin('plugin');

// Default options for the plugin.
const defaults = {
  sdpConstraints: { OfferToReceiveAudio: true, OfferToReceiveVideo: true },
  mediaConstraints: { video: false, audio: false }
};
/**
 * An advanced Video.js plugin for playing WebRTC stream from Ant-mediaserver
 */

class AntmediaWebrtc extends Plugin {
  /**
   * Create a AntmediaWebrtc plugin instance.
   *
   * @param  {Player} player
   *         A Video.js Player instance.
   *
   * @param  {Object} [options]
   *         An optional options object.
   *
   *         While not a core part of the Video.js plugin architecture, a
   *         second argument of options is a convenient way to accept inputs
   *         from your plugin's caller.
   */
  constructor(player, options) {
    super(player);
    this.initiateWebRTCAdaptor(options);
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
  initiateWebRTCAdaptor(options) {
    this.options = videojs.mergeOptions(defaults, options);
    this.options.pcConfig = { iceServers: JSON.parse(options.iceServers) };
    this.options.mediaServerUrl = `${options.streamUrl.split('/').slice(0, 4).join('/')}/websocket`;
    this.options.streamName = options.streamUrl.split('/')[4].split('.webrtc')[0];
    this.options.token = this.getUrlParameter('token');
    this.options.subscriberId = this.getUrlParameter('subscriberId');
    this.options.subscriberCode = this.getUrlParameter('subscriberCode');

    this.webRTCAdaptor = new WebRTCAdaptor({
      websocketUrl: this.options.mediaServerUrl,
      mediaConstraints: this.options.mediaConstraints,
      pcConfig: this.options.pcConfig,
      sdpConstraints: this.options.sdpConstraints,
      player: this.player,
      callback: (info, obj) => {
        switch (info) {
        case ANT_CALLBACKS.INITIALIZED: {
          this.initializedHandler();
          break;
        }
        case ANT_CALLBACKS.PLAY_STARTED: {
          this.joinStreamHandler(obj);
          break;
        }
        case ANT_CALLBACKS.PLAY_FINISHED: {
          this.leaveStreamHandler(obj);
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
        default: {
          this.defaultHandler(info);
          break;
        }
        }
      },
      callbackError: (error) => {
        // add error handler
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
        this.player.trigger('ant-error', { error });
      }
    });
  }
  /**
   * after websocket success connection.
   */
  initializedHandler() {
    this.webRTCAdaptor.play(
      this.options.streamName,
      this.options.token,
      this.options.subscriberId,
      this.options.subscriberCode
    );
  }
  /**
   * after joined stream handler
   *
   * @param {Object} obj callback artefacts
   */
  joinStreamHandler(obj) {
    this.webRTCAdaptor.getStreamInfo(this.options.streamName);
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
      streamName: this.options.streamName
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
  /**
   * default handler.
   *
   * @param {string} info callback event info
   */
  defaultHandler(info) {
    // eslint-disable-next-line no-console
    // console.log(info + ' notification received');
  }
  changeStreamQuality(value) {
    this.webRTCAdaptor.forceStreamQuality(this.options.streamName, value);
    this.player.selectedResolution = value;
    this.player.controlBar.getChild('ResolutionMenuButton').update();

  }

  /**
   * get url parameter
   *
   * @param {string} param callback event info
   */
  getUrlParameter(param) {
    if (this.options.streamUrl.includes('?')) {
      const urlParams = this.options.streamUrl.split('?')[1].split('&').reduce(
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

// Define default values for the plugin's `state` object here.
AntmediaWebrtc.defaultState = {};

// Include the version number.
AntmediaWebrtc.VERSION = VERSION;

// Register the plugin with video.js.
videojs.registerPlugin('antmediaWebrtc', AntmediaWebrtc);

export default AntmediaWebrtc;


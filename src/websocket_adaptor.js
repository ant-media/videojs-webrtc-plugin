/**
 * WebSocketAdaptor for communication via webSocket
 */
import {COMMANDS} from './const/COMMANDS';

export class WebSocketAdaptor {
  /**
   * Create a WebSocketAdaptor instance for communication via webSocket.
   *
   * @param  {Object} [initialValues]
   *         An initialValues object.
   *
   */
  constructor(initialValues) {
    for (const key in initialValues) {
      if (initialValues.hasOwnProperty(key)) {
        this[key] = initialValues[key];
      }
    }
    this.initWebSocketConnection();
  }

  /**
   * Initiate websocket connection.
   *
   * @param {function} callbackConnected callback if connected
   */
  initWebSocketConnection(callbackConnected) {
    this.connecting = true;
    this.connected = false;
    this.pingTimerId = -1;
    // eslint-disable-next-line no-undef
    this.wsConn = new WebSocket(this.websocketUrl);
    this.wsConn.onopen = () => {
      this.pingTimerId = setInterval(() => {
        this.sendPing();
      }, 3000);

      this.connected = true;
      this.connecting = false;
      this.callback('initialized');

      if (typeof callbackConnected !== 'undefined') {
        callbackConnected();
      }
    };

    this.wsConn.onmessage = (event) => {
      const obj = JSON.parse(event.data);

      switch (obj.command) {
      case COMMANDS.TAKE_CANDIDATE: {
        this.webrtcadaptor.takeCandidate(obj.streamId, obj.label, obj.candidate);
        break;
      }

      case COMMANDS.TAKE_CONFIGURATION: {
        this.webrtcadaptor.takeConfiguration(obj.streamId, obj.sdp, obj.type, obj.idMapping);
        break;
      }

      case COMMANDS.STOP: {
        this.webrtcadaptor.closePeerConnection(obj.streamId);
        break;
      }

      case COMMANDS.ERROR: {
        this.callbackError(obj.definition);
        break;
      }

      case COMMANDS.NOTIFICATION: {
        this.callback(obj.definition, obj);
        if (obj.definition === 'play_finished' || obj.definition === 'publish_finished') {
          this.webrtcadaptor.closePeerConnection(obj.streamId);
        }
        break;
      }
      case COMMANDS.STREAM_INFORMATION: {
        this.callback(obj.command, obj);
        break;
      }
      case COMMANDS.PONG: {
        this.callback(obj.command);
        break;
      }
      case COMMANDS.TRACK_LIST: {
        this.callback(obj.command, obj);
        break;
      }
      case COMMANDS.PEER_MESSAGE_COMMAND: {
        this.callback(obj.command, obj);
        break;
      }
      }
    };

    this.wsConn.onerror = (error) => {
      this.connecting = false;
      this.connected = false;

      this.clearPingTimer();
      this.callbackError('WebSocketNotConnected', error);
    };

    this.wsConn.onclose = (event) => {
      this.connecting = false;
      this.connected = false;
      this.clearPingTimer();
      this.callback('closed', event);
    };

  }

  /**
   * Clear websocket ping timer.
   */
  clearPingTimer() {
    if (this.pingTimerId !== -1) {
      clearInterval(this.pingTimerId);
      this.pingTimerId = -1;
    }
  }
  /**
   * send Websocket ping message.
   */
  sendPing() {
    const jsCmd = {
      command: COMMANDS.PING
    };

    this.wsConn.send(JSON.stringify(jsCmd));
  }
  /**
   * close Websocket connection.
   */
  close() {
    this.wsConn.close();
  }

  /**
   * send Websocket message method.
   *
   * @param {string} text message
   */
  send(text) {

    if (!this.connecting && !this.connected) {
      // try to reconnect
      this.initWebSocketConnection(() => {
        this.send(text);
      });
      return;
    }
    this.wsConn.send(text);
  }

  /**
   * check Websocket connection.
   *
   * @return {boolean} status of websocket connection.
   */
  isConnected() {
    return this.connected;
  }

  /**
   * check Websocket connecting.
   *
   * @return {boolean} status of websocket connecting.
   */
  isConnecting() {
    return this.connecting;
  }
}

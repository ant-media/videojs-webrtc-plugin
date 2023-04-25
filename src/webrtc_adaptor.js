import { WebSocketAdaptor } from './websocket_adaptor.js';
import { COMMANDS } from './const/COMMANDS';

/**
 * This structure is used to handle large size data channel messages (like image)
 * which should be splitted into chunks while sending and receiving.
 *
 */
class ReceivingMessage {
  constructor(size) {
    this.size = size;
    this.received = 0;
    this.data = new ArrayBuffer(size);
  }
}

/**
 * Adaptor for WebRTC methods
 */
export class WebRTCAdaptor {
  /**
   * Create a WebRTCAdaptor instance.
   *
   * @param  {Object} initialValues
   *         A WebRTCAdaptor initial values.
   *
   */
  constructor(initialValues) {
    this.pcConfig = null;
    this.websocketUrl = null;
    this.sdpConstraints = null;
    this.remotePeerConnection = [];
    this.remoteDescriptionSet = [];
    this.iceCandidateList = [];
    this.playStreamId = [];
    this.player = null;
    this.webSocketAdaptor = null;
    this.viewerInfo = '';
    this.idMapping = [];
    this.candidateTypes = ['udp', 'tcp'];
    this.dataChannelEnabled = true;

    for (const key in initialValues) {
      if (initialValues.hasOwnProperty(key)) {
        this[key] = initialValues[key];
      }
    }

    this.remoteVideo = this.player;
    this.checkWebSocketConnection();
  }

  /**
   * play WebRTC stream.
   *
   * @param {string} streamId stream Id
   * @param {string} token stream token (opt)
   * @param {string} subscriberId subscriberId (opt)
   * @param {string} subscriberCode subscriberCode (opt)
   */
  play(streamId, token, subscriberId, subscriberCode) {
    this.playStreamId.push(streamId);
    const jsCmd =
    {
      command: COMMANDS.PLAY,
      streamId,
      token,
      subscriberId: subscriberId ? subscriberId : '',
      subscriberCode: subscriberCode ? subscriberCode : '',
      viewerInfo: this.viewerInfo
    };

    this.webSocketAdaptor.send(JSON.stringify(jsCmd));
  }
  /**
   * stop playing WebRTC stream.
   *
   * @param {string} streamId stream Id
   */
  stop(streamId) {
    this.closePeerConnection(streamId);

    const jsCmd = {
      command: COMMANDS.STOP,
      streamId
    };

    this.webSocketAdaptor.send(JSON.stringify(jsCmd));
  }

  /**
   * get info about WebRTC stream.
   *
   * @param {string} streamId stream Id
   */
  getStreamInfo(streamId) {
    const jsCmd = {
      command: COMMANDS.GET_STREAM_INFO,
      streamId
    };

    this.webSocketAdaptor.send(JSON.stringify(jsCmd));
  }

  /**
   * WebRTC onTrack event.
   *
   * @param {Object} event event object
   * @param {string} streamId stream Id
   */
  onTrack(event, streamId) {
    if (this.remoteVideo) {
      const vid = this.remoteVideo.tech().el();

      if (vid.srcObject !== event.streams[0]) {
        vid.srcObject = event.streams[0];
      }
    }
  }

  /**
   * Receive iceCandidate handler.
   *
   * @param {Object} event event object
   * @param {string} streamId stream Id
   */
  iceCandidateReceived(event, streamId) {
    if (event.candidate) {
      let protocolSupported = false;

      if (event.candidate.candidate === '') {
        // event candidate can be received and its value can be "".
        // don't compare the protocols
        protocolSupported = true;
      } else if (typeof event.candidate.protocol === 'undefined') {
        this.candidateTypes.forEach(element => {
          if (event.candidate.candidate.toLowerCase().includes(element)) {
            protocolSupported = true;
          }
        });
      } else {
        protocolSupported = this.candidateTypes.includes(event.candidate.protocol.toLowerCase());
      }

      if (protocolSupported) {
        const jsCmd = {
          command: COMMANDS.TAKE_CANDIDATE,
          streamId,
          label: event.candidate.sdpMLineIndex,
          id: event.candidate.sdpMid,
          candidate: event.candidate.candidate
        };

        this.webSocketAdaptor.send(JSON.stringify(jsCmd));
      } else if (event.candidate.candidate !== '') {
        this.callbackError('protocol_not_supported', 'Support protocols: ' + this.candidateTypes.toString() + ' candidate: ' + event.candidate.candidate);
      }
    }
  }
  initDataChannel(streamId, dataChannel) {
    dataChannel.onerror = (error) => {
      console.log('Data Channel Error:', error);
      const obj = {
        streamId,
        error
      };

      console.log('channel status: ', dataChannel.readyState);
      if (dataChannel.readyState !== 'closed') {
        this.callback('data_channel_error', obj);
      }
    };

    dataChannel.onmessage = (event) => {
      const obj = {
        streamId,
        data: event.data
      };

      const data = obj.data;

      if (typeof data === 'string' || data instanceof String) {
        this.callback('data_received', obj);
      } else {
        const length = data.length || data.size || data.byteLength;

        let view = new Int32Array(data, 0, 1);
        const token = view[0];
        let msg = this.receivingMessages[token];

        if (msg === undefined) {
          view = new Int32Array(data, 0, 2);
          const size = view[1];

          msg = new ReceivingMessage(size);
          this.receivingMessages[token] = msg;
          if (length > 8) {
            console.error('something went wrong in msg receiving');
          }
          return;
        }

        const rawData = data.slice(4, length);
        const dataView = new Uint8Array(msg.data);

        dataView.set(new Uint8Array(rawData), msg.received, length - 4);
        msg.received += length - 4;

        if (msg.size === msg.received) {
          obj.data = msg.data;
          this.callback('data_received', obj);

        }
      }
    };

    dataChannel.onopen = () => {
      this.remotePeerConnection[streamId].dataChannel = dataChannel;
      console.log('Data channel is opened');
      this.callback('data_channel_opened', streamId);
    };

    dataChannel.onclose = () => {
      console.log('Data channel is closed');
      this.callback('data_channel_closed', streamId);

    };
  }
  /**
   * Initiate WebRtc PeerConnection.
   *
   * @param {string} streamId stream Id
   */
  initPeerConnection(streamId) {
    if (!this.remotePeerConnection[streamId]) {
      const closedStreamId = streamId;

      // eslint-disable-next-line no-undef
      this.remotePeerConnection[streamId] = new RTCPeerConnection(this.pcConfig);
      this.remoteDescriptionSet[streamId] = false;
      this.iceCandidateList[streamId] = [];

      this.remotePeerConnection[streamId].onicecandidate = event => {
        this.iceCandidateReceived(event, closedStreamId);
      };
      this.remotePeerConnection[streamId].ontrack = event => {
        this.onTrack(event, closedStreamId);
      };

      this.remotePeerConnection[streamId].oniceconnectionstatechange = () => {
        const obj = { state: this.remotePeerConnection[streamId].iceConnectionState, streamId };

        this.callback('ice_connection_state_changed', obj);
      };
    }
    if (this.dataChannelEnabled) {

      // in play mode, server opens the data channel
      this.remotePeerConnection[streamId].ondatachannel = ev => {
        this.initDataChannel(streamId, ev.channel);
      };

    }
  }

  /**
   * Close WebRtc PeerConnection.
   *
   * @param {string} streamId stream Id
   */
  closePeerConnection(streamId) {
    if (this.remotePeerConnection[streamId]) {
      if (this.remotePeerConnection[streamId].signalingState !== 'closed') {
        this.remotePeerConnection[streamId].close();
        this.remotePeerConnection[streamId] = null;
        delete this.remotePeerConnection[streamId];
        this.playStreamId = this.playStreamId.filter((item) => item !== streamId);
      }
    }
  }

  /**
   * Got the SDP.
   *
   * @param {RTCSessionDescriptionInit} configuration sdp
   * @param {string} streamId stream Id
   */
  gotDescription(configuration, streamId) {
    this.remotePeerConnection[streamId]
      .setLocalDescription(configuration)
      .then(() => {
        const jsCmd = {
          command: COMMANDS.TAKE_CONFIGURATION,
          streamId,
          type: configuration.type,
          sdp: configuration.sdp
        };

        this.webSocketAdaptor.send(JSON.stringify(jsCmd));
      });
  }

  /**
   * take the SDP.
   *
   * @param {string} idOfStream id of stream
   * @param {RTCSessionDescriptionInit} configuration sdp
   * @param {string} typeOfConfiguration stream Id
   * @param {Object} idMapping track Ids
   */
  takeConfiguration(idOfStream, configuration, typeOfConfiguration, idMapping) {
    const streamId = idOfStream;

    this.idMapping[streamId] = idMapping;

    this.initPeerConnection(streamId);
    // eslint-disable-next-line no-undef
    this.remotePeerConnection[streamId].setRemoteDescription({
      sdp: configuration,
      type: typeOfConfiguration
    }).then(() => {
      this.remoteDescriptionSet[streamId] = true;
      const length = this.iceCandidateList[streamId].length;

      for (let i = 0; i < length; i++) {
        this.addIceCandidate(streamId, this.iceCandidateList[streamId][i]);
      }
      this.iceCandidateList[streamId] = [];

      if (typeOfConfiguration === 'offer') {
        this.remotePeerConnection[streamId].createAnswer(this.sdpConstraints)
          .then(config => {
            // support for stereo
            config.sdp = config.sdp.replace('useinbandfec=1', 'useinbandfec=1; stereo=1');
            this.gotDescription(config, streamId);
          });
      }

    }).catch((error) => {
      if (error.toString().includes('InvalidAccessError') || error.toString().includes('setRemoteDescription')) {
        /**
         * This error generally occurs in codec incompatibility.
         * AMS for a now supports H.264 codec. This error happens when some browsers try to open it from VP8.
         */
        this.callbackError('notSetRemoteDescription');
      }
    });

  }

  /**
   * take the Ice Candidate.
   *
   * @param {string} idOfTheStream id of stream
   * @param {string} label sdpMLineIndex
   * @param {Object} takingCandidate candidate
   */
  takeCandidate(idOfTheStream, label, takingCandidate) {
    const streamId = idOfTheStream;
    // eslint-disable-next-line no-undef
    const candidate = new RTCIceCandidate({
      sdpMLineIndex: label,
      candidate: takingCandidate
    });

    this.initPeerConnection(streamId);

    if (this.remoteDescriptionSet[streamId] === true) {
      this.addIceCandidate(streamId, candidate);
    } else {
      this.iceCandidateList[streamId].push(candidate);
    }
  }

  /**
   * take the Ice Candidate.
   *
   * @param {string} streamId id of stream
   * @param {Object} candidate candidate
   */
  addIceCandidate(streamId, candidate) {
    let protocolSupported = false;

    if (candidate.candidate === '') {
      protocolSupported = true;
    } else if (typeof candidate.protocol === 'undefined') {
      this.candidateTypes.forEach(element => {
        if (candidate.candidate.toLowerCase().includes(element)) {
          protocolSupported = true;
        }
      });
    } else {
      protocolSupported = this.candidateTypes.includes(candidate.protocol.toLowerCase());
    }

    if (protocolSupported) {
      this.remotePeerConnection[streamId].addIceCandidate(candidate);
    }
  }

  /**
   * closing WebSocket connection.
   */
  closeWebSocket() {
    for (const key in this.remotePeerConnection) {
      this.remotePeerConnection[key].close();
    }
    // free the remote peer connection by initializing again
    this.remotePeerConnection = [];
    this.webSocketAdaptor.close();
  }
  /**
   * check WebSocket connection.
   */
  checkWebSocketConnection() {
    const isWebSocketAvailable = this.webSocketAdaptor;
    const isWebSocketConnected = isWebSocketAvailable &&
      this.webSocketAdaptor.isConnected() &&
      this.webSocketAdaptor.isConnecting();

    if (!isWebSocketAvailable || !isWebSocketConnected) {
      try {
        this.webSocketAdaptor = new WebSocketAdaptor({
          websocketUrl: this.websocketUrl,
          webrtcadaptor: this,
          callback: this.callback,
          callbackError: this.callbackError
        });
      } catch (e) {
        this.player.createModal('WebSocket connect error');
      }
    }
  }

  /**
   * send peer message
   *
   * @param {string} streamId id of stream
   * @param {string} definition message definition
   * @param {string} data message data
   */
  peerMessage(streamId, definition, data) {
    const jsCmd = {
      command: COMMANDS.PEER_MESSAGE_COMMAND,
      streamId,
      definition,
      data
    };

    this.webSocketAdaptor.send(JSON.stringify(jsCmd));
  }

  /**
   * force stream quality
   *
   * @param {string} streamId id of stream
   * @param {string} resolution stream resolution
   */
  forceStreamQuality(streamId, resolution) {
    const jsCmd = {
      command: COMMANDS.FORCE_STREAM_QUALITY,
      streamId,
      streamHeight: resolution
    };

    this.webSocketAdaptor.send(JSON.stringify(jsCmd));
  }
  /**
   * Called to send data via DataChannel. DataChannel should be enabled on AMS settings.
   *     streamId: unique id for the stream
   *   data: data that you want to send. It may be a text (may in Json format or not) or binary
   */
  sendData(streamId, data) {
    const CHUNK_SIZE = 16000;

    if (this.remotePeerConnection[streamId] !== undefined) {
      const dataChannel = this.remotePeerConnection[streamId].dataChannel;
      const length = data.length || data.size || data.byteLength;
      let sent = 0;

      if (dataChannel === undefined || dataChannel === null) {
        this.callback('data_channel_not_open');
        return;
      }
      if (typeof data === 'string' || data instanceof String) {
        dataChannel.send(data);
      } else {
        const token = Math.floor(Math.random() * 999999);
        const header = new Int32Array(2);

        header[0] = token;
        header[1] = length;

        dataChannel.send(header);

        sent = 0;
        while (sent < length) {
          const size = Math.min(length - sent, CHUNK_SIZE);
          const buffer = new Uint8Array(size + 4);
          const tokenArray = new Int32Array(1);

          tokenArray[0] = token;
          buffer.set(new Uint8Array(tokenArray.buffer, 0, 4), 0);
          const chunk = data.slice(sent, sent + size);

          buffer.set(new Uint8Array(chunk), 4);
          sent += size;

          dataChannel.send(buffer);
        }
      }
    } else {
      console.warn('Send data is called for undefined peer connection with stream id: ' + streamId);
    }
  }
}

'use strict';
// This is mostly copy pasted from webrtc.org/getting-started/peer-connections.

import { io } from 'socket.io-client';

const configuration = {
    'iceServers': [
        { 'urls': 'stun:stun.stunprotocol.org:3478' },
        { 'urls': 'stun:stun01.sipphone.com' },
        { 'urls': 'stun:stun.ekiga.net' },
        { 'urls': 'stun:stun.fwdnet.net' },
        { 'urls': 'stun:stun.ideasip.com' },
        { 'urls': 'stun:stun.iptel.org' },
        { 'urls': 'stun:stun.rixtelecom.se' },
        { 'urls': 'stun:stun.schlund.de' },
        { 'urls': 'stun:stun.l.google.com:19302' },
        { 'urls': 'stun:stun1.l.google.com:19302' },
        { 'urls': 'stun:stun2.l.google.com:19302' },
        { 'urls': 'stun:stun3.l.google.com:19302' },
        { 'urls': 'stun:stun4.l.google.com:19302' },
        { 'urls': 'stun:stunserver.org' },
        { 'urls': 'stun:stun.softjoys.com' },
        { 'urls': 'stun:stun.voiparound.com' },
        { 'urls': 'stun:stun.voipbuster.com' },
        { 'urls': 'stun:stun.voipstunt.com' },
        { 'urls': 'stun:stun.voxgratia.org' },
        { 'urls': 'stun:stun.xten.com' },
    ]
}

export default { join };

function join(room) {
    const socket = io('https://ak2313.user.srcf.net/', { transports: ['polling'/*, 'websocket'*/] });

    const pc = new RTCPeerConnection(configuration);

    pc.onicecandidateerror = event => console.log('ICE candidate error: ' + event.errorCode);

    pc.onicegatheringstatechange = event => console.log(pc.iceGatheringState);
    pc.onconnectionstatechange = event => console.log(pc.connectionState);

    // Listen for local ICE candidates on the local RTCPeerConnection
    pc.addEventListener('icecandidate', event => {
        if (event.candidate) {
            socket.emit('icecandidate', event.candidate);
            console.log(event.candidate);
        }
    });

    // Listen for remote ICE candidates and add them to the local RTCPeerConnection
    socket.on('icecandidate', async candidate => {
        console.log(candidate);
        try {
            await pc.addIceCandidate(candidate);
        } catch (e) {
            console.error('Error adding received ice candidate', e);
        }
    });

    socket.on('error', error => {
        console.error(error);
    });

    // Listen for connectionstatechange on the local RTCPeerConnection
    pc.addEventListener('connectionstatechange', event => {
        if (pc.connectionState === 'connected') {
            console.log('Connected to peer, closing socket');
            socket.close();
        }
    });

    socket.emit('room', room);

    return new Promise((res, rej) => {
        socket.on('matched', async first => {
            if (first) {
                // caller side
                res({ isBlack: true, dc: pc.createDataChannel('data') });

                socket.on('answer', async answer => {
                    await pc.setRemoteDescription(new RTCSessionDescription(answer))
                        .catch(console.error);
                });
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer)
                    .catch(console.error);
                socket.emit('offer', offer);

            } else {
                // recipient side
                pc.addEventListener('datachannel', event => {
                    res({ isBlack: false, dc: event.channel });
                });

                socket.on('offer', async offer => {
                    pc.setRemoteDescription(new RTCSessionDescription(offer))
                        .catch(console.error);
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer)
                        .catch(console.error);
                    socket.emit('answer', answer);
                });
            }
        });
    });
}
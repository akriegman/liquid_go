'use strict';
// This is mostly copy pasted from webrtc.org/getting-started/peer-connections.

import { io } from 'socket.io-client';

const configuration = {
    'iceServers': [
        { 'urls': 'stun:stun.stunprotocol.org:3478' },
    ]
}

export default { join };

function join(room) {
    const socket = io('ws://localhost:8090', { transports: ['websocket', 'polling'] });

    const pc = new RTCPeerConnection(configuration);

    // Listen for local ICE candidates on the local RTCPeerConnection
    pc.addEventListener('icecandidate', event => {
        console.log('icecandidate event');
        if (event.candidate) {
            console.log('Sending ICE candidate');
            socket.emit('icecandidate', event.candidate);
        }
    });

    // Listen for remote ICE candidates and add them to the local RTCPeerConnection
    socket.on('icecandidate', async candidate => {
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
                res(pc.createDataChannel('data'));

                socket.on('answer', async answer => {
                    await pc.setRemoteDescription(new RTCSessionDescription(answer))
                        .catch(console.error);
                });
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer)
                    .catch(console.error);
                socket.emit('offer', offer);
                console.log(offer);

            } else {
                // recipient side
                pc.addEventListener('datachannel', event => {
                    res(event.channel);
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

        // res(pc.createDataChannel('data', { negotiated: true, id: 0 }));
    });
}
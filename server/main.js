'use strict';
const { Server } = require('socket.io');

const io = new Server(8090, {});
log('Listening on 8090');

io.on('connection', socket => {
    log('New connection ' + socket.id);

    socket.on('room', async room => {
        log('Socket ' + socket.id + ' joining room ' + room);
        const players = await io.in(room).fetchSockets();

        if (players.length >= 1) {
            log('Starting match');
            opponent = players[0];
            opponent.leave(room);

            opponent.on('offer', offer => socket.emit('offer', offer));
            socket.on('answer', answer => opponent.emit('answer', answer));

            opponent.on('icecandidate', candidate => socket.emit('icecandidate', candidate));
            socket.on('icecandidate', candidate => opponent.emit('icecandidate', candidate));

            opponent.emit('matched', true);
            socket.emit('matched', false);
        } else {
            log('Waiting for opponent');
            socket.join(room);
        }
    });
});

function log(message) {
    console.log('\x1b[33m[Matchmaking Server]\x1b[m ' + message);
}
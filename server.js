// =========================================
// IMPORTS
// =========================================
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

// =========================================
// SERVER SETUP
// =========================================
const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'https://mueggemg.github.io'],
    methods: ['GET', 'POST'],
  },
});

app.use(cors());

app.get('/', (req, res) => {
  res.send('Chess 2.0 Server läuft!');
});

// =========================================
// SPIELRÄUME
// =========================================
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Spieler verbunden:', socket.id);

  // Raum erstellen
  socket.on('create-room', () => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms.set(roomId, { players: [socket.id], fen: null });
    socket.join(roomId);
    socket.emit('room-created', roomId);
    console.log('Raum erstellt:', roomId);
  });

  // Raum beitreten (Lobby)
  socket.on('join-room', (roomId) => {
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit('error', 'Raum nicht gefunden');
      return;
    }

    if (room.players.length >= 2) {
      socket.emit('error', 'Raum ist voll');
      return;
    }

    room.players.push(socket.id);
    socket.join(roomId);
    socket.emit('room-joined', roomId);

    io.to(roomId).emit('game-start', {
      white: room.players[0],
      black: room.players[1],
    });

    console.log('Spiel gestartet in Raum:', roomId);
  });

  // Spiel beitreten (game.html)
  socket.on('join-game', ({ roomId, color }) => {
    socket.join(roomId);
    console.log(`Spieler ${socket.id} joined room ${roomId} as ${color}`);
    console.log('Räume:', io.sockets.adapter.rooms);
  });

  // Zug weitergeben
  socket.on('move', ({ roomId, move }) => {
    console.log(`Zug in Raum ${roomId}:`, move.from, '->', move.to);
    console.log('Raum Teilnehmer:', io.sockets.adapter.rooms.get(roomId));
    socket.to(roomId).emit('opponent-move', move);
  });

  // Aktionen weitergeben (Aufgeben etc.)
  socket.on('game-action', ({ roomId, action, data }) => {
    socket.to(roomId).emit('opponent-action', { action, data });
  });

  // Verbindung getrennt
  socket.on('disconnect', () => {
    console.log('Spieler getrennt:', socket.id);
    rooms.forEach((room, roomId) => {
      if (room.players.includes(socket.id)) {
        io.to(roomId).emit('opponent-disconnected');
        rooms.delete(roomId);
      }
    });
  });
});

// =========================================
// SERVER STARTEN
// =========================================
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});

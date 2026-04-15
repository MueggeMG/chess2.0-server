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

  // Raum beitreten
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

    // Beide Spieler sind da — Spiel starten
    io.to(roomId).emit('game-start', {
      white: room.players[0],
      black: room.players[1],
    });

    console.log('Spiel gestartet in Raum:', roomId);
  });

  // Zug weitergeben
  socket.on('move', ({ roomId, move }) => {
    socket.to(roomId).emit('opponent-move', move);
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

socket.on('game-action', ({ roomId, action, data }) => {
  socket.to(roomId).emit('opponent-action', { action, data });
});

// =========================================
// SERVER STARTEN
// =========================================
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});

// =========================================
// GAME JOINEN
// =========================================

socket.on('join-game', ({ roomId, color }) => {
  socket.join(roomId);
  console.log(`Spieler ${socket.id} joined room ${roomId} as ${color}`);
});

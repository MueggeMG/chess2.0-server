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
    const room = rooms.get(roomId);

    // Spieler ID updaten
    if (room) {
      if (color === 'white') room.players[0] = socket.id;
      if (color === 'black') room.players[1] = socket.id;
    }

    console.log('join-game, room:', room);
    if (room && room.moves && room.moves.length > 0) {
      console.log('Sende restore-game mit', room.moves.length, 'Zügen');
      socket.emit('restore-game', { moves: room.moves });
    }
  });

  // Zug weitergeben
  socket.on('move', ({ roomId, move }) => {
    const room = rooms.get(roomId);
    if (room) {
      if (!room.moves) room.moves = [];
      room.moves.push(move);
    }
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

  // Undo Anfrage senden
  socket.on('undo-request', ({ roomId }) => {
    socket.to(roomId).emit('undo-requested');
  });

  // Undo Antwort senden
  socket.on('undo-response', ({ roomId, accepted }) => {
    socket.to(roomId).emit('undo-answered', { accepted });
  });
});

// =========================================
// SERVER STARTEN
// =========================================
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});

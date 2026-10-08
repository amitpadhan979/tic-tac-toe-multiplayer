const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;

// Helper to get local network IPv4 addresses
function getNetworkIps() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

// Serve static files from repository root and public folder
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    activeRooms: rooms.size,
    timestamp: new Date().toISOString()
  });
});

// Server info endpoint for client device connection discovery
app.get('/api/server-info', (req, res) => {
  res.json({
    status: 'ok',
    port: PORT,
    ips: getNetworkIps(),
    activeRooms: rooms.size
  });
});

// Room storage
const rooms = new Map();

// Helper to generate unique 6-character alphanumeric room codes
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid easily confused chars (I, O, 0, 1)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

// Winning combinations for Tic-Tac-Toe
const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

function checkWinner(board) {
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: combo };
    }
  }
  if (board.every(cell => cell !== null && cell !== '')) {
    return { winner: 'draw', line: null };
  }
  return null;
}

// Dots & Boxes helpers
function getBoxLineIds(r, c) {
  return [
    `h-${r}-${c}`,     // top
    `h-${r + 1}-${c}`, // bottom
    `v-${r}-${c}`,     // left
    `v-${r}-${c + 1}`  // right
  ];
}

function checkNewlyCompletedBoxes(lines, rows, cols, currentBoxes) {
  const completed = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const boxId = `b-${r}-${c}`;
      if (!currentBoxes[boxId]) {
        const sides = getBoxLineIds(r, c);
        if (sides.every(id => !!lines[id])) {
          completed.push(boxId);
        }
      }
    }
  }
  return completed;
}

io.on('connection', (socket) => {
  let currentRoomCode = null;

  function handlePlayerLeave() {
    if (!currentRoomCode) return;
    const code = currentRoomCode;
    const room = rooms.get(code);
    if (!room) {
      currentRoomCode = null;
      return;
    }

    const playerIndex = room.players.findIndex(p => p.id === socket.id);

    if (playerIndex !== -1) {
      const leavingPlayer = room.players[playerIndex];
      room.players.splice(playerIndex, 1);
      room.rematchVotes.delete(socket.id);

      if (room.spectators.length > 0) {
        const nextPlayer = room.spectators.shift();
        room.players.push({
          id: nextPlayer.id,
          name: nextPlayer.name,
          symbol: leavingPlayer.symbol,
          score: 0
        });

        // Reset board for a fresh game between remaining player and promoted player
        room.status = 'playing';
        room.winner = null;
        room.rematchVotes.clear();

        if (room.gameType === 'tictactoe') {
          room.board = Array(9).fill(null);
          room.winningLine = null;
          room.startingTurn = 'X';
          room.currentTurn = 'X';
        } else {
          room.lines = {};
          room.boxes = {};
          room.scores = { P1: 0, P2: 0 };
          room.startingTurn = 'P1';
          room.currentTurn = 'P1';
        }

        io.to(code).emit('player-promoted', {
          promotedPlayerName: nextPlayer.name,
          promotedPlayerId: nextPlayer.id,
          symbol: leavingPlayer.symbol,
          roomState: getPublicRoomState(room)
        });
      } else {
        if (room.players.length === 0) {
          rooms.delete(code);
        } else {
          room.status = 'waiting';
          if (room.gameType === 'tictactoe') {
            room.board = Array(9).fill(null);
            room.winningLine = null;
            room.startingTurn = 'X';
            room.currentTurn = 'X';
            room.scores = { X: 0, O: 0, draws: 0 };
          } else {
            room.lines = {};
            room.boxes = {};
            room.startingTurn = 'P1';
            room.currentTurn = 'P1';
            room.scores = { P1: 0, P2: 0 };
          }
          room.winner = null;
          room.rematchVotes.clear();

          io.to(code).emit('player-left', {
            playerName: leavingPlayer.name,
            message: `${leavingPlayer.name} has left the match. Waiting for opponent...`,
            roomState: getPublicRoomState(room)
          });
        }
      }
    } else {
      const specIndex = room.spectators.findIndex(s => s.id === socket.id);
      if (specIndex !== -1) {
        room.spectators.splice(specIndex, 1);
        io.to(code).emit('spectator-update', {
          spectatorCount: room.spectators.length,
          roomState: getPublicRoomState(room)
        });
      }
    }

    socket.leave(code);
    currentRoomCode = null;
  }

  // Create Room
  socket.on('create-room', ({ playerName, gameType = 'tictactoe', config = {} }) => {
    if (currentRoomCode) {
      handlePlayerLeave();
    }

    const cleanName = (playerName || 'Player 1').trim().slice(0, 15) || 'Player 1';
    const cleanGameType = gameType === 'dots' ? 'dots' : 'tictactoe';
    const roomCode = generateRoomCode();
    currentRoomCode = roomCode;

    const symbol = cleanGameType === 'dots' ? 'P1' : 'X';

    const room = {
      code: roomCode,
      gameType: cleanGameType,
      players: [
        { id: socket.id, name: cleanName, symbol: symbol, score: 0 }
      ],
      spectators: [],
      status: 'waiting',
      winner: null,
      rematchVotes: new Set(),
      startingTurn: symbol,
      currentTurn: symbol
    };

    if (cleanGameType === 'tictactoe') {
      room.board = Array(9).fill(null);
      room.winningLine = null;
      room.scores = { X: 0, O: 0, draws: 0 };
    } else {
      const rows = Math.min(Math.max(parseInt(config.rows, 10) || 3, 2), 15);
      const cols = Math.min(Math.max(parseInt(config.cols, 10) || 3, 2), 15);
      room.rows = rows;
      room.cols = cols;
      room.lines = {};
      room.boxes = {};
      room.scores = { P1: 0, P2: 0 };
    }

    rooms.set(roomCode, room);
    socket.join(roomCode);

    socket.emit('room-created', {
      roomCode,
      gameType: cleanGameType,
      playerSymbol: symbol,
      playerName: cleanName,
      roomState: getPublicRoomState(room)
    });
  });

  // Join Room
  socket.on('join-room', ({ roomCode, playerName }) => {
    if (currentRoomCode) {
      handlePlayerLeave();
    }

    const code = (roomCode || '').trim().toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      socket.emit('error-message', { message: `Room "${code}" not found. Please verify the code.` });
      return;
    }

    currentRoomCode = code;
    socket.join(code);

    if (room.players.length === 1) {
      const cleanName = (playerName || 'Player 2').trim().slice(0, 15) || 'Player 2';
      const symbol = room.gameType === 'dots' ? 'P2' : 'O';
      const player2 = { id: socket.id, name: cleanName, symbol: symbol, score: 0 };
      room.players.push(player2);
      room.status = 'playing';
      if (!room.startingTurn) {
        room.startingTurn = room.gameType === 'dots' ? 'P1' : 'X';
      }
      room.currentTurn = room.startingTurn;

      socket.emit('room-joined', {
        roomCode: code,
        gameType: room.gameType,
        playerSymbol: symbol,
        playerName: cleanName,
        isSpectator: false,
        roomState: getPublicRoomState(room)
      });

      // Notify entire room that game has started
      io.to(code).emit('game-started', {
        message: `${player2.name} joined! Game started.`,
        gameType: room.gameType,
        roomState: getPublicRoomState(room)
      });
    } else {
      // Room has 2 players already -> Join as spectator
      const spectatorName = (playerName || `Spectator ${room.spectators.length + 1}`).trim().slice(0, 15);
      room.spectators.push({ id: socket.id, name: spectatorName });

      socket.emit('room-joined', {
        roomCode: code,
        gameType: room.gameType,
        playerSymbol: null,
        playerName: spectatorName,
        isSpectator: true,
        roomState: getPublicRoomState(room)
      });

      io.to(code).emit('spectator-update', {
        spectatorCount: room.spectators.length,
        message: `${spectatorName} joined as spectator.`,
        roomState: getPublicRoomState(room)
      });
    }
  });

  // TIC-TAC-TOE: Make Move
  socket.on('make-move', ({ index }) => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.status !== 'playing' || room.gameType !== 'tictactoe') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    if (player.symbol !== room.currentTurn) {
      socket.emit('error-message', { message: "It's not your turn!" });
      return;
    }

    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > 8 || room.board[index] !== null) {
      socket.emit('error-message', { message: 'Invalid move!' });
      return;
    }

    room.board[index] = player.symbol;
    const result = checkWinner(room.board);

    if (result) {
      room.status = 'ended';
      room.winner = result.winner;
      room.winningLine = result.line;

      if (result.winner === 'draw') {
        room.scores.draws++;
      } else {
        room.scores[result.winner]++;
        const winnerPlayer = room.players.find(p => p.symbol === result.winner);
        if (winnerPlayer) winnerPlayer.score++;
      }

      io.to(currentRoomCode).emit('game-over', {
        board: room.board,
        winner: result.winner,
        winningLine: result.line,
        scores: room.scores,
        roomState: getPublicRoomState(room)
      });
    } else {
      room.currentTurn = room.currentTurn === 'X' ? 'O' : 'X';

      io.to(currentRoomCode).emit('move-made', {
        index,
        symbol: player.symbol,
        nextTurn: room.currentTurn,
        board: room.board,
        roomState: getPublicRoomState(room)
      });
    }
  });

  // DOTS AND BOXES: Draw Line Move
  socket.on('dots-move-line', ({ lineId }) => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.status !== 'playing' || room.gameType !== 'dots') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    if (player.symbol !== room.currentTurn) {
      socket.emit('error-message', { message: "It's not your turn!" });
      return;
    }

    if (!lineId || typeof lineId !== 'string') {
      socket.emit('error-message', { message: 'Invalid move!' });
      return;
    }

    const parts = lineId.split('-');
    if (parts.length !== 3) {
      socket.emit('error-message', { message: 'Invalid move format!' });
      return;
    }

    const [type, rStr, cStr] = parts;
    const r = parseInt(rStr, 10);
    const c = parseInt(cStr, 10);

    if (!Number.isInteger(r) || !Number.isInteger(c)) {
      socket.emit('error-message', { message: 'Invalid move coordinates!' });
      return;
    }

    if (type === 'h') {
      if (r < 0 || r > room.rows || c < 0 || c >= room.cols) {
        socket.emit('error-message', { message: 'Line coordinates out of bounds!' });
        return;
      }
    } else if (type === 'v') {
      if (r < 0 || r >= room.rows || c < 0 || c > room.cols) {
        socket.emit('error-message', { message: 'Line coordinates out of bounds!' });
        return;
      }
    } else {
      socket.emit('error-message', { message: 'Invalid line type!' });
      return;
    }

    if (room.lines[lineId]) {
      socket.emit('error-message', { message: 'This line is already drawn!' });
      return;
    }

    // Claim line
    room.lines[lineId] = player.symbol;

    // Check completed boxes
    const newBoxes = checkNewlyCompletedBoxes(room.lines, room.rows, room.cols, room.boxes);

    newBoxes.forEach(boxId => {
      room.boxes[boxId] = player.symbol;
      room.scores[player.symbol]++;
      player.score++;
    });

    const totalBoxes = room.rows * room.cols;
    const totalClaimed = Object.keys(room.boxes).length;

    if (totalClaimed === totalBoxes) {
      room.status = 'ended';
      if (room.scores.P1 > room.scores.P2) room.winner = 'P1';
      else if (room.scores.P2 > room.scores.P1) room.winner = 'P2';
      else room.winner = 'draw';

      io.to(currentRoomCode).emit('dots-game-over', {
        lineId,
        symbol: player.symbol,
        newBoxes,
        winner: room.winner,
        scores: room.scores,
        roomState: getPublicRoomState(room)
      });
    } else {
      // If completed at least one box, player gets an extra turn!
      const gotExtraTurn = newBoxes.length > 0;
      if (!gotExtraTurn) {
        room.currentTurn = room.currentTurn === 'P1' ? 'P2' : 'P1';
      }

      io.to(currentRoomCode).emit('dots-move-made', {
        lineId,
        symbol: player.symbol,
        newBoxes,
        nextTurn: room.currentTurn,
        gotExtraTurn,
        roomState: getPublicRoomState(room)
      });
    }
  });

  // Request Rematch
  socket.on('request-rematch', () => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    room.rematchVotes.add(socket.id);

    if (room.rematchVotes.size >= 2) {
      room.status = 'playing';
      room.winner = null;
      room.rematchVotes.clear();

      if (room.gameType === 'tictactoe') {
        room.board = Array(9).fill(null);
        room.winningLine = null;
        room.startingTurn = room.startingTurn === 'X' ? 'O' : 'X';
        room.currentTurn = room.startingTurn;
      } else {
        room.lines = {};
        room.boxes = {};
        room.scores = { P1: 0, P2: 0 }; // Box count resets on new round
        room.startingTurn = room.startingTurn === 'P1' ? 'P2' : 'P1';
        room.currentTurn = room.startingTurn;
      }

      io.to(currentRoomCode).emit('rematch-start', {
        message: 'Rematch accepted! Starting new round...',
        gameType: room.gameType,
        roomState: getPublicRoomState(room)
      });
    } else {
      socket.to(currentRoomCode).emit('rematch-requested', {
        playerName: player.name
      });
      socket.emit('rematch-pending');
    }
  });

  // Live reactions / Quick Chat
  socket.on('send-reaction', ({ emoji, text }) => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;

    const sender = room.players.find(p => p.id === socket.id) || 
                   room.spectators.find(s => s.id === socket.id);
    const senderName = sender ? sender.name : 'Someone';

    io.to(currentRoomCode).emit('new-reaction', {
      senderName,
      senderId: socket.id,
      emoji: emoji || null,
      text: (text || '').trim().slice(0, 80)
    });
  });

  // Explicit leave room
  socket.on('leave-room', () => {
    handlePlayerLeave();
  });

  // Disconnect
  socket.on('disconnect', () => {
    handlePlayerLeave();
  });
});

function getPublicRoomState(room) {
  const state = {
    code: room.code,
    gameType: room.gameType,
    players: room.players.map(p => ({ id: p.id, name: p.name, symbol: p.symbol, score: p.score })),
    spectatorsCount: room.spectators.length,
    startingTurn: room.startingTurn,
    currentTurn: room.currentTurn,
    status: room.status,
    winner: room.winner,
    scores: room.scores
  };

  if (room.gameType === 'tictactoe') {
    state.board = room.board;
    state.winningLine = room.winningLine;
  } else {
    state.rows = room.rows;
    state.cols = room.cols;
    state.lines = room.lines;
    state.boxes = room.boxes;
    state.config = { rows: room.rows, cols: room.cols };
  }

  return state;
}

server.listen(PORT, '0.0.0.0', () => {
  const ips = getNetworkIps();
  console.log(`\n======================================================`);
  console.log(`⚡ Game Arcade Server running on port ${PORT}`);
  console.log(`   - Local:    http://localhost:${PORT}`);
  ips.forEach(ip => {
    console.log(`   - Network:  http://${ip}:${PORT} (Connect from another device!)`);
  });
  console.log(`======================================================\n`);
});

// Graceful shutdown handling
function handleShutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  io.close(() => {
    server.close(() => {
      console.log('HTTP and WebSocket server closed.');
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));


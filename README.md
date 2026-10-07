# ⚡ Dual Arcade: Tic-Tac-Toe & Dots and Boxes (Multiplayer)

> A modern, real-time multiplayer web gaming platform featuring **Tic-Tac-Toe Pro** and **Dots and Boxes**. Supports instant cross-device multiplayer via Node.js Socket.IO and WebRTC P2P (for serverless GitHub Pages hosting), smart AI engines, procedural sound effects, and a sleek neon dark/light UI.

[![Play Live Demo](https://img.shields.io/badge/🎮%20Play%20Live-GitHub%20Pages-00f0ff?style=for-the-badge)](https://amitpadhan.github.io/tic-tac-toe-multiplayer/)

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Active-success.svg)
![Node](https://img.shields.io/badge/Node.js-v18%2B-green.svg)
![Socket.IO](https://img.shields.io/badge/Socket.IO-v4.7.5-black.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg)

🌐 **Live Demo on GitHub Pages**: [https://amitpadhan.github.io/tic-tac-toe-multiplayer/](https://amitpadhan.github.io/tic-tac-toe-multiplayer/)

---

## 🕹️ Main Game Selector

When you open the app, you are greeted by the **Main Game Selector Hub**:
1. **Tic-Tac-Toe Pro**: Fast-paced classic 3x3 duel.
2. **Dots and Boxes**: Territory capture with lines, closed boxes, and bonus turns!
3. You can switch between games at any time using the **🕹️ Games** button in the header.

---

## 🎮 Included Games & Modes

### 1. ⭕❌ Tic-Tac-Toe Pro
- **Online Match**: Create a private 6-character room code. Connect across phones, laptops, and tablets in real-time.
- **Solo vs AI**:
  - **Easy**: Casual practice.
  - **Medium**: Blocks lines and takes immediate wins.
  - **Master (Unbeatable)**: Full **Minimax algorithm** with depth scoring and alpha-beta pruning.
- **Pass & Play**: Local 2-player mode on the same device.

### 2. 🔲 Dots and Boxes
- **Territory Capture**: Connect adjacent dots with glowing lines. The player who draws the 4th side of a 1x1 box claims that box (+1 point) and earns a **BONUS TURN**!
- **Grid Sizes**: 
  - `2x2 Boxes` (Quick Blitz)
  - `3x3 Boxes` (Classic 9 Boxes)
  - `4x4 Boxes` (Pro Strategic 16 Boxes)
- **Online Match**: Play against friends on other devices in real-time.
- **Solo vs AI**:
  - **Casual**: Fun, random play.
  - **Balanced**: Takes open boxes and avoids giving away 3rd sides.
  - **Master**: Strategic chain AI that controls initiative and minimizes chain sacrifices!
- **Pass & Play**: 2-player local mode with responsive touch controls.

---

## 📱 Cross-Device Connection (How to Connect from Other Devices)

### Connecting Devices on the Same Local Wi-Fi Network:
1. Start the server on your computer:
   ```bash
   npm start
   ```
2. The terminal displays your local network address:
   ```
   ======================================================
   ⚡ Game Arcade Server running on port 3000
      - Local:    http://localhost:3000
      - Network:  http://192.168.1.X:3000 (Connect from another device!)
   ======================================================
   ```
3. Open `http://192.168.1.X:3000` on your mobile phone, tablet, or another computer on the same Wi-Fi.
4. On Device 1: Click **Play Online** -> **Create Room** to get a 6-character code (e.g. `K9M2P4`).
5. On Device 2: Click **Play Online** -> **Join Room** -> Enter the code `K9M2P4`.
6. Match begins instantly!

### Direct Invite Links:
- Click **Copy Link** inside the waiting lobby. The link includes your room code (`?game=tictactoe&room=CODE` or `?game=dots&room=CODE`).
- Opening the invite link on another device auto-populates the room code and connects directly.

---

## ✨ Features

- 🔊 **Zero-Dependency Sound Effects**: Synthesized audio using browser-native **Web Audio API** (moves, line snaps, box completions, victory fanfare, reactions).
- 🎊 **Confetti Cannon**: Canvas particle celebration on match victory.
- ⚡ **Neon Cyberpunk Aesthetic**: Glowing cyan, pink, and indigo palettes with smooth animations.
- 🌗 **Theme Switcher**: Switch between **Dark Mode** and **Clean Slate Light Mode**.
- 📱 **Mobile & Desktop Responsive**: Optimized tap targets for easy line drawing and cell clicking on smartphones.
- 💬 **Live Reactions**: Quick floating emoji reactions (`🔥`, `👏`, `😂`, `😮`, `💀`, `GG`).
- 🔄 **Rematch System**: Quick rematch voting without needing to re-enter room codes.

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/amitpadhan/tic-tac-toe-multiplayer.git
cd tic-tac-toe-multiplayer
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start the application
```bash
npm start
```

Open your browser at `http://localhost:3000`.

---

## 📁 Project Architecture

```
tic-tac-toe-multiplayer/
├── Dockerfile                  # Container definition
├── LICENSE                     # MIT License
├── README.md                   # Documentation
├── package.json                # Project manifest and scripts
├── server.js                   # Node.js + Express + Socket.IO server (Multi-game)
├── index.html                  # HTML5 Game Hub & Game Arenas
├── style.css                   # Cyberpunk glassmorphism styles & responsive grids
├── assets/                     # Favicons and SVG vector assets
├── js/
│   ├── app.js                  # Main Hub controller, routing & global UI
│   ├── network.js              # Unified Socket.IO & WebRTC P2P Network Manager
│   ├── tictactoe.js            # Tic-Tac-Toe Minimax AI & game engine
│   ├── dots.js                 # Dots and Boxes strategic AI & game engine
│   ├── confetti.js             # Canvas particle explosion engine
│   └── sound.js                # Web Audio API procedural sound synthesizer
└── public/                     # Mirrored distribution files
```

---

## 🌐 Network & Synchronization

- **Socket.IO Real-time Events**: Bi-directional event bus ensuring low-latency move broadcasts.
- **WebRTC Peer-to-Peer Fallback**: Enables low-overhead direct mesh matchmaking when server relay is optional.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) &copy; 2026 Amit Padhan.

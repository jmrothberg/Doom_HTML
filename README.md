# JMR's Multiplayer DOOM-like Game

A browser-based multiplayer first-person shooter inspired by DOOM, built with JavaScript and WebSocket technology.

## Features
- Real-time Multiplayer: Play with friends in the same maze
- DOOM-style Graphics: Raycasting engine for pseudo-3D rendering
- Multiple Weapons: Choose between pistol, machine gun, and plasma gun
- Enemy AI: Face off against different types of monster birds
- Power-ups: Collect health and ammo throughout the maze
- Dynamic Lighting: Distance-based shading and texture mapping
- Minimap: Real-time position tracking of players and monsters

## Quick Start
1. Clone the repository:
   git clone https://github.com/yourusername/jmr-doom.git
   cd jmr-doom

2. Start the server:
   python server.py

3. Open your browser and navigate to:
   http://localhost:8000

## How to Play
- Movement: Arrow keys
- Shoot: Spacebar
- Switch Weapons: Left Mouse Click
- Restart: R (when dead)
- Exit: E (when dead)

## Technical Stack
- Frontend:
  - Pure JavaScript (ES6+)
  - HTML5 Canvas
  - CSS3
- Backend:
  - Python
  - WebSocket (websockets library)
  - Async I/O

## Project Structure
jmr-doom/
├── assets/
│   ├── bird1_transparent.png
│   ├── bird2_transparent.png
│   ├── bird3_transparent.png
│   ├── doom_wall_texture.png
│   ├── pistol.png
│   ├── machinegun.png
│   ├── plasma.png
│   ├── player_client.png
│   ├── shoot.wav
│   └── hit.wav
├── js/
│   ├── main.js
│   ├── networking.js
│   ├── constants.js
│   └── assetLoader.js
├── index.html
├── styles.css
├── server.py
└── README.md

## Game Mechanics

Weapons:
- Pistol: Basic weapon, low spread, quick cooldown
- Machine Gun: Medium damage, higher spread
- Plasma Gun: High damage, highest spread, slow cooldown

Monsters:
- Red Bird: Basic enemy, medium health
- Brown Bird: Tougher enemy, higher damage
- Yellow Bird: Elite enemy, highest health and damage

Power-ups:
- Health Pack: Restores 25 HP
- Ammo Pack: Adds 50 ammo

## Configuration
Game constants can be modified in js/constants.js:
- Screen dimensions
- Player settings
- Monster behavior
- Weapon characteristics
- Network update frequency

## Networking
The game uses WebSocket for real-time communication:
- Player positions and states
- Monster synchronization
- Power-up collection
- Damage dealing
- Map generation and sharing

## Contributing
1. Fork the repository
2. Create your feature branch (git checkout -b feature/AmazingFeature)
3. Commit your changes (git commit -m 'Add some AmazingFeature')
4. Push to the branch (git push origin feature/AmazingFeature)
5. Open a Pull Request

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments
- Original DOOM by id Software
- Raycasting tutorial by Lode Vandevenne
- Asset creators (see assets/credits.txt)

## Known Issues
- Occasional desync in monster positions
- Rare texture loading issues
- WebSocket reconnection can sometimes fail

## Contact
Your Name - @yourtwitter
Project Link: https://github.com/yourusername/jmr-doom

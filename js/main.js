import { NetworkManager } from './networking.js';
import { assetLoader } from './assetLoader.js';
import { drawSpriteFrame } from './spriteAtlas.js';
import { MONSTER_SETTINGS, WEAPON_ORDER, WEAPON_DEFINITIONS } from './constants.js';

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Set canvas size with proper aspect ratio
        const aspectRatio = 4/3; // Standard aspect ratio for DOOM-like games
        
        // Calculate size based on window dimensions while maintaining aspect ratio
        let width = window.innerWidth;
        let height = window.innerHeight;
        
        if (width / height > aspectRatio) {
            // Window is too wide - use height as constraint
            width = height * aspectRatio;
        } else {
            // Window is too tall - use width as constraint
            height = width / aspectRatio;
        }
        
        this.canvas.width = width;
        this.canvas.height = height;
        
        // Initialize multiplayer components
        this.otherPlayers = new Map();
        this.player = {
            id: Math.random().toString(36).substr(2, 6),  // Short 6-character version
            x: 0,
            y: 0,
            angle: 0
        };
        
        // Initialize empty map
        this.map = this.generateMaze(23, 23);
        
        // Find starting position after map is generated
        const [startX, startY] = this.findEmptySpot();
        this.playerX = startX;
        this.playerY = startY;
        this.player.x = startX;
        this.player.y = startY;
        
        // Player stats
        this.playerAngle = 0;
        this.playerHealth = 100;
        this.playerScore = 0;
        this.playerAmmo = 100;
        
        // Weapons — 9 types; HUD uses three PNG frames each (WEAPON_FRAMES + WEAPON_DEFINITIONS).
        this.weapons = [...WEAPON_ORDER];
        this.currentWeapon = 0;
        this.weaponCooldown = 0;
        this.weaponSpread = 0.01;
        this.weaponDamage = 10;
        this.weaponCooldownTime = 10;
        this.weaponAmmoUsage = 1;
        this.weaponRange = 8;
        this.weaponConeHalf = Math.PI / 6;
        this.applyWeaponStatsFromCurrent();
        
        // Monsters (sprites from atlases in assets/better/sprites.json — draw via assetLoader.getAtlasCell)
        this.monsters = [];
        
        // Define specific attributes for each monster type
        this.monsterTypes = {
            monster1: {
                health: 100,
                hit_power: 5,      
                baseSpeed: 0.01,    // Will add random 0.02 to this
                fireDistance: 8,
                shootCooldown: 200  // Added cooldown property
            },
            monster2: {
                health: 125,
                hit_power: 10,      
                baseSpeed: 0.02,    // Will add random 0.02 to this
                fireDistance: 10,
                shootCooldown: 200  // Added cooldown property
            },
            monster3: {
                health: 156,
                hit_power: 20,      
                baseSpeed: 0.03,    // Will add random 0.02 to this
                fireDistance: 12,
                shootCooldown: 300  // Added cooldown property
            }
        };
        
        // Initial monsters — fill toward cap (assets/sprites PNG clips per tools/export_sprite_atlases.py)
        const initialMonsters = Math.min(8, MONSTER_SETTINGS.MAX_MONSTERS);
        for (let i = 0; i < initialMonsters; i++) {
            this.spawnMonster();
        }
        
        // Wall tile from exported environment frame
        this.wallCrop = assetLoader.getNamedFrame('wallTile');
        
        // Floor gradient
        this.floorGradient = this.ctx.createLinearGradient(0, this.canvas.height/2, 0, this.canvas.height);
        this.floorGradient.addColorStop(0, '#666666');
        this.floorGradient.addColorStop(1, '#222222');
        
        // Input handling
        this.keys = {};
        document.addEventListener('keydown', (e) => {
            if (this.playerHealth <= 0) {
                if (e.key.toLowerCase() === 'r') {
                    if (this.networkManager && this.networkManager.ws && this.networkManager.ws.readyState === WebSocket.OPEN) {
                        this.networkManager.ws.send(JSON.stringify({ type: "restart", playerId: this.player.id }));
                    }
                    window.location.reload();
                } else if (e.key.toLowerCase() === 'e') {
                    window.location.href = "about:blank";
                }
                return; // ignore other keys when game over
            }
            this.keys[e.key] = true;
            // Spacebar shooting
            if (e.code === 'Space') {
                this.shoot();
            }
        });
        document.addEventListener('keyup', (e) => this.keys[e.key] = false);
        
        // Desktop: left-click outside mobile controls cycles weapons (must NOT bubble from #mobileControls or each click fires twice with the Weapon button).
        document.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            if (e.target.closest('#mobileControls')) return;
            this.switchWeapon();
        });
        
        // Game clock
        this.lastTime = performance.now();

        // Add crosshair settings
        this.crosshairSize = 10;
        this.crosshairColor = '#00FF00';  // GREEN

        // Power-up settings (sprites from pickups atlas — healthPickup / ammoPickup in sprites.json)
        this.powerUps = [];
        this.powerUpTypes = ['health', 'ammo'];

        // Sounds
        this.shootSound = assetLoader.sounds['shoot'];
        this.hitSound = assetLoader.sounds['hit'];
        
        // Debug flag
        this.debug = true;  // We'll use this to log important events

        // Add damage feedback
        this.damageFlash = 0;  // For screen flash effect

        // Monster attack settings
        this.monsterShootCooldown = 100;
        this.monsterDamage = 10;
        this.monsterRange = 8;

        // Player movement constants (finer control adjustments)
        this.moveSpeed = 0.1;   // Slower movement for finer control
        this.rotSpeed = 0.05;   // Slower rotation for finer control
    }

    generateMaze(width, height) {
        // Initialize with walls
        const maze = Array(height).fill().map(() => Array(width).fill(1));
        
        // Recursive maze generation
        const carve = (x, y) => {
            maze[y][x] = 0; // Clear current cell
            
            // Define possible directions (up, right, down, left)
            const directions = [
                [0, -2], [2, 0], [0, 2], [-2, 0]
            ];
            
            // Shuffle directions
            for (let i = directions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [directions[i], directions[j]] = [directions[j], directions[i]];
            }
            
            // Try each direction
            for (const [dx, dy] of directions) {
                const newX = x + dx;
                const newY = y + dy;
                
                if (newX > 0 && newX < width - 1 && newY > 0 && newY < height - 1 
                    && maze[newY][newX] === 1) {
                    // Carve passage
                    maze[y + dy/2][x + dx/2] = 0;
                    carve(newX, newY);
                }
            }
        };
        
        // Start from a random point
        carve(1, 1);
        
        // Add some random openings (like your Python version)
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                if (maze[y][x] === 1 && Math.random() < 0.1) {
                    // Check if it would create a valid path
                    const surroundingPaths = 
                        (maze[y-1][x] === 0) + 
                        (maze[y+1][x] === 0) + 
                        (maze[y][x-1] === 0) + 
                        (maze[y][x+1] === 0);
                    if (surroundingPaths >= 2) {
                        maze[y][x] = 0;
                    }
                }
            }
        }
        
        return maze;
    }

    findEmptySpot() {
        while (true) {
            const x = Math.floor(Math.random() * (this.map[0].length - 2)) + 1;
            const y = Math.floor(Math.random() * (this.map.length - 2)) + 1;
            if (this.map[y][x] === 0) {
                return [x, y];
            }
        }
    }

    handleInput(dt) {
        let newX = this.playerX;
        let newY = this.playerY;
        
        // Use the class movement speeds
        if (this.keys['ArrowUp']) {
            newX += Math.cos(this.playerAngle) * this.moveSpeed;
            newY += Math.sin(this.playerAngle) * this.moveSpeed;
        }
        if (this.keys['ArrowDown']) {
            newX -= Math.cos(this.playerAngle) * this.moveSpeed;
            newY -= Math.sin(this.playerAngle) * this.moveSpeed;
        }
        if (this.keys['ArrowLeft']) {
            this.playerAngle -= this.rotSpeed;
        }
        if (this.keys['ArrowRight']) {
            this.playerAngle += this.rotSpeed;
        }
        
        // Check for collisions before updating position
        const mapX = Math.floor(newX);
        const mapY = Math.floor(newY);
        
        // Only update position if new location is not a wall
        if (mapX >= 0 && mapX < this.map[0].length && 
            mapY >= 0 && mapY < this.map.length) {
            if (this.map[mapY][mapX] === 0) {
                this.playerX = newX;
                this.playerY = newY;
            }
        }
    }

    castRay(angle) {
        let rayX = this.playerX;
        let rayY = this.playerY;
        let distance = 0;
        
        while (distance < 16) {
            distance += 0.1;
            rayX = this.playerX + Math.cos(angle) * distance;
            rayY = this.playerY + Math.sin(angle) * distance;
            
            // Convert to map coordinates
            const mapX = Math.floor(rayX);
            const mapY = Math.floor(rayY);
            
            // Check if ray hit a wall
            if (mapX >= 0 && mapX < this.map[0].length && 
                mapY >= 0 && mapY < this.map.length) {
                if (this.map[mapY][mapX] === 1) {
                    return {
                        distance: distance,
                        rayX: rayX,
                        rayY: rayY
                    };
                }
            }
        }
        return {
            distance: distance,
            rayX: rayX,
            rayY: rayY
        };
    }

    /** Advance one animation frame when timer elapses (labeled PNG clips). */
    advanceMonsterAnim(monster, dt) {
        const mk = `monster${monster.spriteIndex + 1}`;
        const clips = assetLoader.monsterClips[mk];
        if (!clips) return;
        const state = monster.animState || 'idle';
        const arr = clips[state];
        if (!arr || arr.length === 0) return;

        const fpsTable = { idle: 5, walk: 11, attack: 14, hurt: 11, death: 8 };
        const fps = fpsTable[state] || 8;
        const fd = 1 / fps;
        monster.animTime = (monster.animTime || 0) + dt;
        if (monster.animTime < fd) return;
        monster.animTime -= fd;

        monster.animFrameIndex = (monster.animFrameIndex || 0) + 1;

        if (state === 'death') {
            if (monster.animFrameIndex >= arr.length) {
                monster.animFrameIndex = arr.length - 1;
                monster.pendingRemove = true;
            }
            return;
        }
        if (state === 'hurt') {
            if (monster.animFrameIndex >= arr.length) {
                monster.animFrameIndex = 0;
                monster.animState = monster._movedCache ? 'walk' : 'idle';
            }
            return;
        }
        if (state === 'attack') {
            if (monster.animFrameIndex >= arr.length) {
                monster.animFrameIndex = 0;
                monster.animState = monster._movedCache ? 'walk' : 'idle';
            }
            return;
        }
        monster.animFrameIndex %= arr.length;
    }

    /** HUD weapon sprite: 0 idle, 1 fire, 2 recovery — matches three PNGs per weapon */
    weaponHudFrameIndex() {
        const c = this.weaponCooldown;
        const max = this.weaponCooldownTime;
        if (c <= 0) return 0;
        const t = c / max;
        if (t > 0.52) return 1;
        return 2;
    }

    spawnMonster() {
        if (this.monsters.length >= MONSTER_SETTINGS.MAX_MONSTERS) return;
        const [x, y] = this.findEmptySpot();
        if (x !== undefined && y !== undefined) {
            if (this.debug) console.log('Spawning monster at:', x, y);
            
            // Define sprite-specific colors
            const monsterColors = ['#FF0000', '#8B4513', '#FFD700'];  // Red, Brown, Yellow
            const spriteIndex = Math.floor(Math.random() * 3);
            const monsterType = this.monsterTypes[`monster${spriteIndex + 1}`];
            
            this.monsters.push({
                x: x,
                y: y,
                health: monsterType.health,
                spriteIndex: spriteIndex,
                speed: monsterType.baseSpeed + Math.random() * 0.02,
                angle: Math.random() * Math.PI * 2,
                shootCooldown: monsterType.shootCooldown,  // Initialize with full cooldown
                hit_power: monsterType.hit_power,
                fireDistance: monsterType.fireDistance,
                monsterShootCooldown: monsterType.shootCooldown,
                color: monsterColors[spriteIndex],
                lastX: x,
                lastY: y,
                animState: 'idle',
                animFrameIndex: 0,
                animTime: 0,
                pendingRemove: false,
                _movedCache: false
            });
        }
    }

    switchWeapon() {
        this.currentWeapon = (this.currentWeapon + 1) % this.weapons.length;
        this.applyWeaponStatsFromCurrent();
    }

    /** Sync damage, range, cone, ammo cost, cooldown length, crosshair from WEAPON_DEFINITIONS */
    applyWeaponStatsFromCurrent() {
        const key = this.weapons[this.currentWeapon];
        const def = WEAPON_DEFINITIONS[key];
        if (!def) return;
        this.weaponDamage = def.damage;
        this.weaponRange = def.range;
        this.weaponConeHalf = def.coneHalf;
        this.weaponSpread = def.spread;
        this.weaponCooldownTime = def.cooldownFrames;
        this.weaponAmmoUsage = def.ammoPerShot;
        this.crosshairColor = def.crosshairColor;
        this.crosshairSize = def.crosshairSize;
    }

    shoot() {
        const ammoCost = this.weaponAmmoUsage;
        const canFire =
            this.weaponCooldown === 0 &&
            (ammoCost === 0 || this.playerAmmo >= ammoCost);
        if (canFire) {
            if (this.debug) console.log('Shooting! Ammo:', this.playerAmmo);
            this.shootSound.currentTime = 0;
            this.shootSound.play().catch(e => console.log('Sound play error:', e));
            this.weaponCooldown = this.weaponCooldownTime;
            if (ammoCost > 0) {
                this.playerAmmo -= ammoCost;
            }
            
            // Find closest player
            let closestPlayer = null;
            let closestPlayerDist = Infinity;
            this.otherPlayers.forEach(otherPlayer => {
                const dx = otherPlayer.x - this.playerX;
                const dy = otherPlayer.y - this.playerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < closestPlayerDist) {
                    closestPlayer = otherPlayer;
                    closestPlayerDist = distance;
                }
            });
            
            // Find closest monster
            let closestMonster = null;
            let closestMonsterDist = Infinity;
            this.monsters.forEach(monster => {
                const dx = monster.x - this.playerX;
                const dy = monster.y - this.playerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < closestMonsterDist) {
                    closestMonster = monster;
                    closestMonsterDist = distance;
                }
            });
            
            // Hit the closer of the two
            if (closestPlayer && closestPlayerDist < closestMonsterDist) {
                // Check player hit (existing code)
                const dx = closestPlayer.x - this.playerX;
                const dy = closestPlayer.y - this.playerY;
                let angle = Math.atan2(dy, dx) - this.playerAngle;
                while (angle < -Math.PI) angle += 2 * Math.PI;
                while (angle > Math.PI) angle -= 2 * Math.PI;
                
                if (closestPlayerDist < this.weaponRange && Math.abs(angle) < this.weaponConeHalf) {
                    if (this.debug) console.log('Hit player!', closestPlayer.id);
                    if (this.networkManager) {
                        this.networkManager.sendPlayerHit(closestPlayer.id, this.weaponDamage);
                    }
                }
            } else {
                // Monster hits — hurt/death clips (labeled PNGs); removal after death animation finishes
                this.monsters.forEach(monster => {
                    const dx = monster.x - this.playerX;
                    const dy = monster.y - this.playerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    let angle = Math.atan2(dy, dx) - this.playerAngle;
                    while (angle < -Math.PI) angle += 2 * Math.PI;
                    while (angle > Math.PI) angle -= 2 * Math.PI;
                    
                    if (
                        distance < this.weaponRange &&
                        Math.abs(angle) < this.weaponConeHalf &&
                        monster.animState !== 'death'
                    ) {
                        console.log('Hit monster!', monster.health);
                        monster.health -= this.weaponDamage;
                        monster.animTime = 0;
                        monster.animFrameIndex = 0;
                        if (monster.health <= 0) {
                            monster.animState = 'death';
                            this.playerScore += 100;
                        } else {
                            monster.animState = 'hurt';
                        }
                    }
                });
            }
        }
    }

    isCollision(x, y) {
        if (!this.map) return true; // Prevent movement if map isn't initialized
        
        const cellX = Math.floor(x);
        const cellY = Math.floor(y);
        
        // Boundary check
        if (cellX < 0 || cellX >= this.map[0].length || cellY < 0 || cellY >= this.map.length) {
            return true;
        }
        
        return this.map[cellY][cellX] === 1;
    }

    /**
     * BFS from the player's tile: dist[y][x] = grid steps to the player (0 on player cell).
     * Unreachable cells stay -1. Monsters descend this field for shortest maze paths.
     */
    buildPlayerDistanceField() {
        const map = this.map;
        if (!map || !map.length) return null;
        const h = map.length;
        const w = map[0].length;
        const dist = Array(h).fill(null).map(() => Array(w).fill(-1));
        let px = Math.floor(this.playerX);
        let py = Math.floor(this.playerY);
        px = Math.max(0, Math.min(w - 1, px));
        py = Math.max(0, Math.min(h - 1, py));
        if (map[py][px] !== 0) {
            return dist;
        }
        const q = [[px, py]];
        dist[py][px] = 0;
        for (let qi = 0; qi < q.length; qi++) {
            const [x, y] = q[qi];
            const d = dist[y][x];
            const nbs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            for (const [dx, dy] of nbs) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                if (map[ny][nx] !== 0) continue;
                if (dist[ny][nx] !== -1) continue;
                dist[ny][nx] = d + 1;
                q.push([nx, ny]);
            }
        }
        return dist;
    }

    /** Adjacent walkable tile that minimizes distance-to-player (follows BFS layers). */
    getNextCellTowardPlayer(mx, my, dist) {
        if (!dist) return null;
        const h = dist.length;
        const w = dist[0].length;
        if (mx < 0 || mx >= w || my < 0 || my >= h) return null;
        const here = dist[my][mx];
        if (here < 0 || here === 0) return null;
        let best = null;
        let bestD = Infinity;
        const nbs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const [dx, dy] of nbs) {
            const nx = mx + dx;
            const ny = my + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            if (this.map[ny][nx] !== 0) continue;
            const nd = dist[ny][nx];
            if (nd < 0) continue;
            if (nd < bestD) {
                bestD = nd;
                best = { nx, ny };
            }
        }
        return best;
    }

    spawnPowerUp() {
        if (this.powerUps.length < 5) {  // Limit number of power-ups
            const [x, y] = this.findEmptySpot();
            // Count currently spawned power-ups of each type
            let currentHealth = this.powerUps.filter(p => p.type === 'health').length;
            let currentAmmo = this.powerUps.filter(p => p.type === 'ammo').length;
            const maxHealth = 3;
            const maxAmmo = 3;
            let type;
            if (currentHealth >= maxHealth && currentAmmo < maxAmmo) {
                type = 'ammo';
            } else if (currentAmmo >= maxAmmo && currentHealth < maxHealth) {
                type = 'health';
            } else {
                type = this.powerUpTypes[Math.floor(Math.random() * this.powerUpTypes.length)];
            }
            if (this.debug) console.log('Spawning power-up:', type, 'at', x, y);
            this.powerUps.push({ x, y, type });
        }
    }

    checkPowerUpCollision() {
        // If a powerup was very recently collected, skip processing.
        if (this.powerUpCollectionCooldown) return;
        
        // Process collisions
        this.powerUps = this.powerUps.filter(powerUp => {
            const dx = powerUp.x - this.playerX;
            const dy = powerUp.y - this.playerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 0.5) {  // Player touched power-up
                // Apply the power-up's effect only if not previously collected.
                if (!powerUp.collected) {
                    if (powerUp.type === 'health') {
                        const oldHealth = this.playerHealth;
                        this.playerHealth = Math.min(this.playerHealth + 25, 100);
                        if (this.debug) console.log('Health changed from', oldHealth, 'to', this.playerHealth, '(capped at 100)');
                    } else if (powerUp.type === 'ammo') {
                        this.playerAmmo = Math.min(this.playerAmmo + 50, 100);
                        if (this.debug) console.log('Ammo increased to:', this.playerAmmo, '(capped at 100)');
                    }
                    powerUp.collected = true;
                    // Activate a short cooldown to prevent multiple collections in quick succession.
                    this.powerUpCollectionCooldown = true;
                    setTimeout(() => { this.powerUpCollectionCooldown = false; }, 100);
                    if (this.networkManager) this.networkManager.sendPowerUpUpdate();
                }
                // Remove the powerup from the array immediately.
                return false;
            }
            return true;
        });
    }

    render() {
        // Clear screen and draw floor/ceiling
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw floor
        this.ctx.fillStyle = this.floorGradient;
        this.ctx.fillRect(0, this.canvas.height/2, this.canvas.width, this.canvas.height/2);

        // Prepare arrays for sprite rendering
        let spriteDistances = [];
        this.monsters.forEach(monster => {
            const dx = monster.x - this.playerX;
            const dy = monster.y - this.playerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            spriteDistances.push({
                monster: monster,
                distance: distance
            });
        });

        // Sort sprites by distance (furthest first)
        spriteDistances.sort((a, b) => b.distance - a.distance);  // Monsters furthest to closest

        // Calculate player distances similarly
        let playerDistances = Array.from(this.otherPlayers.entries()).map(([id, player]) => {
            const dx = player.x - this.playerX;
            const dy = player.y - this.playerY;
            return {
                player,
                distance: Math.sqrt(dx * dx + dy * dy)
            };
        }).sort((a, b) => b.distance - a.distance);  // Players furthest to closest

        // Keep track of which index we're at in each array
        let monsterIndex = spriteDistances.length - 1;  // Start from closest
        let playerIndex = playerDistances.length - 1;   // Start from closest

        // Store wall distances for sprite occlusion
        const wallDistances = new Array(this.canvas.width).fill(Infinity);
        
        // Cast rays and render walls
        const FOV = Math.PI / 3;
        const angleStep = FOV / this.canvas.width;
        
        for (let i = 0; i < this.canvas.width; i++) {
            const rayAngle = this.playerAngle - FOV/2 + angleStep * i;
            const rayResult = this.castRay(rayAngle);
            wallDistances[i] = rayResult.distance;
            
            // Calculate wall height
            const wallHeight = (this.canvas.height / rayResult.distance) * 1.5;
            
            // Wall slice from exported PNG tile + distance shading (darker when farther)
            const wc = this.wallCrop;
            const wallTop = (this.canvas.height - wallHeight) / 2;
            if (wc && wc.img.complete) {
                const wallX = (rayResult.rayX) % 1;
                const textureX = Math.floor(wallX * wc.rect.sw);
                
                try {
                    this.ctx.drawImage(
                        wc.img,
                        wc.rect.sx + textureX, wc.rect.sy,
                        1, wc.rect.sh,
                        i, wallTop,
                        1, wallHeight
                    );
                    const t = Math.min(1, rayResult.distance / 16);
                    const overlayAlpha = (1 - 0.35) * t;
                    if (overlayAlpha > 0.001) {
                        this.ctx.fillStyle = `rgba(0,0,0,${overlayAlpha})`;
                        this.ctx.fillRect(i, wallTop, 1, wallHeight);
                    }
                    continue;  // Texture drawn successfully, skip to next slice
                } catch (e) {
                    // Texture drawing failed, will fall through to the fallback below
                }
            }

            // Single fallback for both cases: texture not loaded or drawing failed
            const shade = Math.min(1, 1 - (rayResult.distance / 16));
            this.ctx.fillStyle = `rgb(${shade * 255},${shade * 255},${shade * 255})`;
            this.ctx.fillRect(
                i, 
                (this.canvas.height - wallHeight) / 2,
                1,
                wallHeight
            );
        }

        // Render sprites (monsters) with wall occlusion
        while (monsterIndex >= 0 || playerIndex >= 0) {
            let monsterDist = monsterIndex >= 0 ? spriteDistances[monsterIndex].distance : -1;
            let playerDist = playerIndex >= 0 ? playerDistances[playerIndex].distance : -1;

            if (monsterDist >= 0 && (playerDist < 0 || monsterDist <= playerDist)) {
                // Render monster using existing monster render code
                const {monster, distance} = spriteDistances[monsterIndex];
                const dx = monster.x - this.playerX;
                const dy = monster.y - this.playerY;
                
                let spriteAngle = Math.atan2(dy, dx) - this.playerAngle;
                while (spriteAngle < -Math.PI) spriteAngle += 2 * Math.PI;
                while (spriteAngle > Math.PI) spriteAngle -= 2 * Math.PI;
                
                if (Math.abs(spriteAngle) < FOV/2 + 0.2) {
                    const spriteSize = Math.min(1000, (this.canvas.height / distance) * 1.5);
                    const spriteX = (spriteAngle / FOV + 0.5) * this.canvas.width - spriteSize/2;
                    const spriteY = (this.canvas.height - spriteSize) / 2;
                    
                    // Check if sprite is behind wall
                    const spriteScreenX = Math.floor(spriteX + spriteSize/2);
                    if (spriteScreenX >= 0 && spriteScreenX < this.canvas.width && 
                        distance < wallDistances[spriteScreenX]) {
                        const mk = `monster${monster.spriteIndex + 1}`;
                        const st = monster.animState || 'idle';
                        const clip = assetLoader.getMonsterClip(mk, st);
                        const fi = clip ? Math.min(monster.animFrameIndex || 0, clip.length - 1) : 0;
                        const frameImg = clip && clip[fi];
                        if (frameImg && frameImg.complete) {
                            this.ctx.drawImage(frameImg, spriteX, spriteY, spriteSize, spriteSize);
                        }
                    }
                }
                monsterIndex--;
            } else {
                // Render player using existing player render code
                const {player, distance} = playerDistances[playerIndex];
                const dx = player.x - this.playerX;
                const dy = player.y - this.playerY;
                
                let playerAngle = Math.atan2(dy, dx) - this.playerAngle;
                while (playerAngle < -Math.PI) playerAngle += 2 * Math.PI;
                while (playerAngle > Math.PI) playerAngle -= 2 * Math.PI;
                
                if (Math.abs(playerAngle) < FOV/2) {  // Within FOV
                    const spriteSize = Math.min(1000, (this.canvas.height / distance) * 1.5);
                    const spriteX = (playerAngle / FOV + 0.5) * this.canvas.width - spriteSize/2;
                    const spriteY = (this.canvas.height - spriteSize) / 2;
                    
                    // Check if player is behind a wall
                    const spriteScreenX = Math.floor(spriteX + spriteSize/2);
                    if (spriteScreenX >= 0 && spriteScreenX < this.canvas.width &&
                        distance < wallDistances[spriteScreenX]) {
                        
                        const pw = assetLoader.playerClips.walk;
                        const pi = pw && pw.length ? Math.floor(performance.now() / 180) % pw.length : 0;
                        const pImg = pw && pw[pi];
                        if (pImg && pImg.complete) {
                            this.ctx.drawImage(pImg, spriteX, spriteY, spriteSize, spriteSize);
                        } else {
                            // Fallback: draw an orange circle
                            this.ctx.fillStyle = '#FFA500';
                            this.ctx.beginPath();
                            this.ctx.arc(spriteX + spriteSize/2, spriteY + spriteSize/2, spriteSize/2, 0, Math.PI * 2);
                            this.ctx.fill();
                        }
                    }
                }
                playerIndex--;
            }
        }

        // Draw power-ups in 3D view with wall occlusion
        this.powerUps.forEach(powerUp => {
            const dx = powerUp.x - this.playerX;
            const dy = powerUp.y - this.playerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 16) { // Only render if within view distance
                let powerUpAngle = Math.atan2(dy, dx) - this.playerAngle;
                while (powerUpAngle < -Math.PI) powerUpAngle += 2 * Math.PI;
                while (powerUpAngle > Math.PI) powerUpAngle -= 2 * Math.PI;
                
                if (Math.abs(powerUpAngle) < FOV/2) {  // Within FOV
                    const spriteSize = Math.min(100, (this.canvas.height / distance) * 0.5);
                    const spriteX = (powerUpAngle / FOV + 0.5) * this.canvas.width - spriteSize/2;
                    const spriteY = (this.canvas.height - spriteSize) / 2;
                    
                    // Check if power-up is behind wall
                    const spriteScreenX = Math.floor(spriteX + spriteSize/2);
                    if (spriteScreenX >= 0 && spriteScreenX < this.canvas.width && 
                        distance < wallDistances[spriteScreenX]) {
                        const nf = assetLoader.getNamedFrame(powerUp.type === 'health' ? 'healthPickup' : 'ammoPickup');
                        if (nf && nf.img.complete) {
                            drawSpriteFrame(this.ctx, nf.img, nf.rect, spriteX, spriteY, spriteSize, spriteSize);
                        }
                    }
                }
            }
        });

        // Draw minimap
        const minimapSize = 200;
        const cellSize = minimapSize / this.map.length;
        
        // Draw map cells
        for (let y = 0; y < this.map.length; y++) {
            for (let x = 0; x < this.map[y].length; x++) {
                this.ctx.fillStyle = this.map[y][x] ? '#fff' : '#666';
                this.ctx.fillRect(
                    x * cellSize,
                    y * cellSize,
                    cellSize - 1,
                    cellSize - 1
                );
            }
        }
        
        // Draw power-ups on minimap with correct colors
        this.powerUps.forEach(powerUp => {
            this.ctx.fillStyle = powerUp.type === 'health' ? '#00FF00' : '#0000FF';
            this.ctx.beginPath();
            this.ctx.arc(
                powerUp.x * cellSize,
                powerUp.y * cellSize,
                4,
                0,
                Math.PI * 2
            );
            this.ctx.fill();
        });
        
        // Draw monsters on minimap using their color
        this.monsters.forEach(monster => {
            this.ctx.fillStyle = monster.color || '#ff0';
            this.ctx.beginPath();
            this.ctx.arc(
                monster.x * cellSize,
                monster.y * cellSize,
                3,
                0,
                Math.PI * 2
            );
            this.ctx.fill();
        });
        
        // Draw player (Orange)
        this.ctx.fillStyle = '#FFA500';  // Orange
        this.ctx.beginPath();
        this.ctx.arc(
            this.playerX * cellSize,
            this.playerY * cellSize,
            4,
            0,
            Math.PI * 2
        );
        this.ctx.fill();
        
        // Draw player direction line (made longer and more visible)
        this.ctx.strokeStyle = '#FF0000';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(
            this.playerX * cellSize,
            this.playerY * cellSize
        );
        this.ctx.lineTo(
            (this.playerX + Math.cos(this.playerAngle) * 1.0) * cellSize,
            (this.playerY + Math.sin(this.playerAngle) * 1.0) * cellSize
        );
        this.ctx.stroke();

        // Draw other players (Red)
        this.otherPlayers.forEach((player) => {
            this.ctx.fillStyle = '#FF0000';  // Red
            this.ctx.beginPath();
            this.ctx.arc(
                player.x * cellSize,
                player.y * cellSize,
                4,
                0,
                Math.PI * 2
            );
            this.ctx.fill();
        });



        // Draw weapon (idle / firing / recovery frame from cooldown)
        const wkey = this.weapons[this.currentWeapon];
        const frames = assetLoader.weaponFrames[wkey];
        const fi = this.weaponHudFrameIndex();
        const weapon = frames && frames[fi];
        if (weapon && weapon.complete) {
            this.ctx.drawImage(
                weapon,
                this.canvas.width / 2 - 100,
                this.canvas.height - 200,
                200,
                200
            );
        }

        // Add damage flash effect
        if (this.damageFlash > 0) {
            this.ctx.fillStyle = `rgba(255, 0, 0, ${this.damageFlash / 20})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Optional: Add visual indicator when monsters are shooting
        this.monsters.forEach(monster => {
            if (monster.shootCooldown > this.monsterShootCooldown - 5) {  // Flash when shooting
                const dx = monster.x - this.playerX;
                const dy = monster.y - this.playerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 16) { // Only render if within view distance
                    let monsterAngle = Math.atan2(dy, dx) - this.playerAngle;
                    while (monsterAngle < -Math.PI) monsterAngle += 2 * Math.PI;
                    while (monsterAngle > Math.PI) monsterAngle -= 2 * Math.PI;
                    
                    if (Math.abs(monsterAngle) < Math.PI/3) {  // Within FOV
                        // Add muzzle flash or attack indicator here
                        // ... existing monster rendering code ...
                    }
                }
            }
        });

        // Draw HUD elements for the local player
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '20px Arial';
        const rightAlign = this.canvas.width - 200 - 30;
        this.ctx.fillText(`Health: ${this.playerHealth}`, rightAlign, 30);
        this.ctx.fillText(`Ammo: ${this.playerAmmo}`, rightAlign, 60);
        this.ctx.fillText(`Score: ${this.playerScore}`, rightAlign, 90);
        const wIdx = this.currentWeapon + 1;
        const wTotal = this.weapons.length;
        this.ctx.fillText(
            `Weapon: ${WEAPON_DEFINITIONS[this.weapons[this.currentWeapon]].label} (${wIdx}/${wTotal})`,
            rightAlign,
            120
        );

        // List competing players (their health, etc.)
        let hudOffsetY = 150;
        this.otherPlayers.forEach((player, id) => {
            this.ctx.fillText(`Player ${id}: Health ${player.health}`, rightAlign, hudOffsetY);
            hudOffsetY += 30;
        });
        
        // Move crosshair drawing to the very end
        this.ctx.strokeStyle = this.weaponCooldown > 0 ? '#FF0000' : this.crosshairColor;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width/2 - this.crosshairSize, this.canvas.height/2);
        this.ctx.lineTo(this.canvas.width/2 + this.crosshairSize, this.canvas.height/2);
        this.ctx.moveTo(this.canvas.width/2, this.canvas.height/2 - this.crosshairSize);
        this.ctx.lineTo(this.canvas.width/2, this.canvas.height/2 + this.crosshairSize);
        this.ctx.stroke();

        // At the end of the render() method, add a game-over overlay:
        if (this.playerHealth <= 0) {
            this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = "#fff";
            this.ctx.textAlign = "center";
            this.ctx.font = "48px Arial";
            this.ctx.fillText("JMR's Multiplayer DOOM", this.canvas.width / 2, this.canvas.height / 2 - 50);
            this.ctx.font = "32px Arial";
            this.ctx.fillText("(R)estart   (E)xit", this.canvas.width / 2, this.canvas.height / 2 + 10);
        }
    }

    update(dt) {
        // Always update network state—even if the local player is dead—to let others know your final state.
        if (this.networkManager) {
            this.networkManager.update();
        }

        // If the local player is dead, show the game over overlay (but the final state has already been sent).
        if (this.playerHealth <= 0) return;
        
        this.handleInput(dt);
        this.checkPowerUpCollision();
        
        // Spawn power-ups more frequently for testing
        if (Math.random() < 0.02) {
            this.spawnPowerUp();
        }
        
        // Update weapon cooldown
        if (this.weaponCooldown > 0) {
            this.weaponCooldown--;
        }
        
        // One BFS from player per frame — all monsters share shortest-path maze routing
        const playerDist = this.buildPlayerDistanceField();

        // Update monsters — PNG clip FSM (idle / walk / attack / hurt / death from assetLoader.monsterClips)
        this.monsters.forEach(monster => {
            if (monster.lastX === undefined) monster.lastX = monster.x;
            if (monster.lastY === undefined) monster.lastY = monster.y;

            if (monster.animState === 'death') {
                monster._movedCache = false;
                this.advanceMonsterAnim(monster, dt);
                monster.lastX = monster.x;
                monster.lastY = monster.y;
                return;
            }

            if (monster.animState !== 'hurt') {
                const mx = Math.floor(monster.x);
                const my = Math.floor(monster.y);
                let moveDX = 0;
                let moveDY = 0;
                const next = this.getNextCellTowardPlayer(mx, my, playerDist);
                const row = playerDist && playerDist[my];
                const here = row ? row[mx] : -1;
                if (next && here !== undefined && here >= 0) {
                    const tx = next.nx + 0.5;
                    const ty = next.ny + 0.5;
                    moveDX = tx - monster.x;
                    moveDY = ty - monster.y;
                } else {
                    moveDX = this.playerX - monster.x;
                    moveDY = this.playerY - monster.y;
                }
                let mag = Math.sqrt(moveDX * moveDX + moveDY * moveDY);
                if (mag > 1e-6) {
                    moveDX = (moveDX / mag) * monster.speed;
                    moveDY = (moveDY / mag) * monster.speed;
                    const candidateX = monster.x + moveDX;
                    const candidateY = monster.y + moveDY;
                    if (!this.isCollision(candidateX, candidateY)) {
                        monster.x = candidateX;
                        monster.y = candidateY;
                    } else if (!this.isCollision(candidateX, monster.y)) {
                        monster.x = candidateX;
                    } else if (!this.isCollision(monster.x, candidateY)) {
                        monster.y = candidateY;
                    }
                }
            }

            const dx = monster.x - this.playerX;
            const dy = monster.y - this.playerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            monster.angle = Math.atan2(dy, dx);

            let fired = false;
            if (distance < this.monsterRange && monster.animState !== 'hurt') {
                if (monster.shootCooldown <= 0) {
                    const rayResult = this.castRay(monster.angle);
                    if (rayResult.distance >= distance) {
                        if (this.debug) console.log('Monster shooting at player!');
                        this.playerHealth = Math.max(0, this.playerHealth - this.monsterDamage);
                        this.damageFlash = 10;
                        monster.shootCooldown = monster.monsterShootCooldown;
                        fired = true;
                        if (this.hitSound) {
                            this.hitSound.currentTime = 0;
                            this.hitSound.play().catch(e => console.log('Sound play error:', e));
                        }
                    }
                }
            }

            if (monster.shootCooldown > 0) {
                monster.shootCooldown--;
            }

            const moved = Math.abs(monster.x - monster.lastX) > 1e-4 || Math.abs(monster.y - monster.lastY) > 1e-4;
            monster._movedCache = moved;
            monster.lastX = monster.x;
            monster.lastY = monster.y;

            if (fired) {
                monster.animState = 'attack';
                monster.animFrameIndex = 0;
                monster.animTime = 0;
            } else if (monster.animState !== 'hurt' && monster.animState !== 'attack') {
                monster.animState = moved ? 'walk' : 'idle';
            }

            this.advanceMonsterAnim(monster, dt);
        });

        this.monsters = this.monsters.filter(m => !m.pendingRemove);

        if (this.monsters.length < MONSTER_SETTINGS.MAX_MONSTERS && Math.random() < 0.03) {
            try {
                this.spawnMonster();
            } catch (e) {
                console.error('Failed to spawn monster:', e);
            }
        }

        // Update damage flash effect
        if (this.damageFlash > 0) {
            this.damageFlash--;
        }
    }

    gameLoop() {
        const currentTime = performance.now();
        const dt = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        this.update(dt);
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }

    start() {
        this.lastTime = performance.now();
        this.gameLoop();
    }

    // Add a method to safely update the map
    updateMap(newMap) {
        if (!newMap) return;
        
        this.map = newMap;
        // After map update, ensure player is in valid position
        const [startX, startY] = this.findEmptySpot();
        this.playerX = startX;
        this.playerY = startY;
        this.player.x = startX;
        this.player.y = startY;
    }

    handlePlayerHit(damage) {
        // Reduce the local player's health by the damage received,
        // ensuring it doesn't drop below zero.
        this.playerHealth = Math.max(0, this.playerHealth - damage);
        this.damageFlash = 10; // trigger a red screen flash or similar effect

        // (Optional) Log or handle death if health reaches zero.
        if (this.playerHealth === 0) {
            console.log("You died! Press (R) to restart or (E) to exit.");
        }
    }
}

// Initialize when the window loads
window.addEventListener('load', async () => {
    const canvas = document.getElementById('gameCanvas');
    
    // Wait for assets to load before creating game
    await assetLoader.loadAll();
    
    const game = new Game(canvas);
    
    // Get the current hostname or IP
    const serverIP = window.location.hostname;
    const wsUrl = `ws://${serverIP}:8765`;
    console.log("Connecting to WebSocket server at:", wsUrl);
    game.networkManager = new NetworkManager(game, false);
    game.networkManager.init(wsUrl);
    
    game.start();

    // Weapon button always wired (not gated on other controls) — one pointerdown = one slot.
    const btnWeapon = document.getElementById('btn-weapon');
    if (btnWeapon) {
        btnWeapon.addEventListener('pointerdown', (e) => {
            if (e.button !== 0 && e.button !== -1) return;
            e.preventDefault();
            e.stopPropagation();
            game.switchWeapon();
        });
    }

    // Add mobile control event listeners for touch devices (iPhone/iPad)
    const btnUp = document.getElementById('btn-up');
    const btnDown = document.getElementById('btn-down');
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const btnShoot = document.getElementById('btn-shoot');

    if (btnUp && btnDown && btnLeft && btnRight && btnShoot) {
        // Mapping button IDs to corresponding arrow keys
        const keyMap = {
            "btn-up": "ArrowUp",
            "btn-down": "ArrowDown",
            "btn-left": "ArrowLeft",
            "btn-right": "ArrowRight"
        };

        ["btn-up", "btn-down", "btn-left", "btn-right"].forEach(id => {
            const btn = document.getElementById(id);
            // Enable continuous action with touchstart and touchend
            btn.addEventListener('touchstart', (e) => {
                game.keys[keyMap[id]] = true;
                e.preventDefault();
            });
            btn.addEventListener('touchend', (e) => {
                game.keys[keyMap[id]] = false;
                e.preventDefault();
            });
            btn.addEventListener('touchcancel', (e) => {
                game.keys[keyMap[id]] = false;
                e.preventDefault();
            });
            // Also add mouse events (for testing or hybrid devices)
            btn.addEventListener('mousedown', (e) => {
                game.keys[keyMap[id]] = true;
                e.preventDefault();
            });
            btn.addEventListener('mouseup', (e) => {
                game.keys[keyMap[id]] = false;
                e.preventDefault();
            });
            btn.addEventListener('mouseleave', (e) => {
                game.keys[keyMap[id]] = false;
                e.preventDefault();
            });
        });

        // Shoot button: trigger shooting on touchstart/mousedown (single action)
        btnShoot.addEventListener('touchstart', (e) => {
            game.shoot();
            e.preventDefault();
        });
        btnShoot.addEventListener('mousedown', (e) => {
            game.shoot();
            e.preventDefault();
        });

        // Add event listeners for Restart and Exit buttons (only for mobile)
        const btnRestart = document.getElementById('btn-restart');
        const btnExit = document.getElementById('btn-exit');

        if (btnRestart && btnExit) {
            btnRestart.addEventListener('touchstart', (e) => {
                if (game.networkManager && game.networkManager.ws && game.networkManager.ws.readyState === WebSocket.OPEN) {
                    game.networkManager.ws.send(JSON.stringify({ type: "restart", playerId: game.player.id }));
                }
                window.location.reload();
                e.preventDefault();
            });
            btnRestart.addEventListener('mousedown', (e) => {
                if (game.networkManager && game.networkManager.ws && game.networkManager.ws.readyState === WebSocket.OPEN) {
                    game.networkManager.ws.send(JSON.stringify({ type: "restart", playerId: game.player.id }));
                }
                window.location.reload();
                e.preventDefault();
            });

            btnExit.addEventListener('touchstart', (e) => {
                window.location.href = "about:blank";
                e.preventDefault();
            });
            btnExit.addEventListener('mousedown', (e) => {
                window.location.href = "about:blank";
                e.preventDefault();
            });
        }

        // Periodically show/hide the Game Over controls on mobile if the player is dead.
        setInterval(() => {
            const gameOverControls = document.getElementById('gameOverControls');
            if (game.playerHealth <= 0) {
                gameOverControls.style.display = 'flex';
            } else {
                gameOverControls.style.display = 'none';
            }
        }, 100);
    }
});

export default Game;
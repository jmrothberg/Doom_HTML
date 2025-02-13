class NetworkManager {
    constructor(game, isServer) {
        this.game = game;
        this.isServer = isServer;
        this.socket = null;
        this.connected = false;
        this.initialMapSent = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.playerId = Math.random().toString(36).substr(2, 6);
        this.updateCounter = 0;
        this.updateFrequency = 3;  // Only send every 3rd frame
    }

    /**
     * Initialize and connect the WebSocket.
     * @param {string} url - The WebSocket server URL (e.g., "ws://your-server-address:8765")
     */
    init(url) {
        console.log("Initializing NetworkManager with URL:", url);
        this.connectToServer(url);
    }

    connectToServer(url) {
        try {
            console.log("Attempting to connect to WebSocket server...");
            this.socket = new WebSocket(url);

            this.socket.onopen = () => {
                console.log("WebSocket connection established successfully");
                this.connected = true;
                
                // Send join message with unique ID
                this.socket.send(JSON.stringify({
                    type: "join",
                    playerId: this.playerId
                }));
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    // Comment out or remove this debug log:
                    // console.log("Received data type:", data.type || "update");
                    
                    switch(data.type) {
                        case "request_map":
                            console.log("We're first! Sending our map...");
                            this.socket.send(JSON.stringify({
                                type: "init",
                                map: this.game.map,
                                powerups: this.game.powerUps,
                                monsters: this.game.monsters
                            }));
                            break;

                        case "init":
                            console.log("Received existing map from server");
                            this.game.map = data.map;
                            this.game.powerUps = data.powerups;
                            if (data.monsters) {
                                this.game.monsters = data.monsters;
                            }
                            break;

                        case "player_hit":
                            if (data.targetId === this.playerId) {
                                this.game.handlePlayerHit(data.damage);
                            }
                            break;

                        case "player_disconnect":
                            this.game.otherPlayers.delete(data.playerId);
                            break;

                        default:
                            if (data.player && data.player.id !== this.playerId) {
                                this.game.otherPlayers.set(data.player.id, {
                                    ...data.player,
                                    health: data.player.health || 100  // Ensure health is preserved
                                });
                            }
                            if (data.monsters) {
                                data.monsters = data.monsters.map((networkMonster, i) => {
                                    const localMonster = this.game.monsters[i] || {};
                                    return {
                                        x: networkMonster.x,
                                        y: networkMonster.y,
                                        health: networkMonster.health,
                                        spriteIndex: networkMonster.spriteIndex,
                                        speed: networkMonster.speed || 0.03,
                                        angle: networkMonster.angle || 0,
                                        shootCooldown: (localMonster.shootCooldown !== undefined) ? localMonster.shootCooldown : 0,
                                        color: networkMonster.color || ['#FF0000', '#8B4513', '#FFD700'][networkMonster.spriteIndex]
                                    };
                                });
                                this.game.monsters = data.monsters;
                            }
                            if (data.powerups) this.game.powerUps = data.powerups;
                    }
                } catch (error) {
                    console.error("Error processing received message:", error);  // Keep error logs
                }
            };

            this.socket.onerror = (error) => {
                console.error("WebSocket error occurred:", error);
                this.connected = false;
            };

            this.socket.onclose = () => {
                console.log("WebSocket connection closed");
                this.connected = false;
            };

        } catch (error) {
            console.error("Error creating WebSocket connection:", error);
        }
    }

    /**
     * Called regularly (for example, in your game loop) to send out key state data.
     * Sends this game data:
     *   - Local player { id, x, y }
     *   - Array of monsters: each with { x, y, type }
     *   - Array of power-ups: each with { x, y, type }
     */
    update() {
        if (this.connected && this.socket && this.socket.readyState === WebSocket.OPEN) {
            // Only send update every nth frame
            this.updateCounter++;
            if (this.updateCounter % this.updateFrequency === 0) {
                const outgoingData = {
                    player: {
                        id: this.playerId,
                        x: this.game.playerX,
                        y: this.game.playerY,
                        angle: this.game.playerAngle,
                        health: this.game.playerHealth,
                        ammo: this.game.playerAmmo,
                        score: this.game.playerScore,
                        weapon: this.game.weapons[this.game.currentWeapon]
                    },
                    monsters: this.game.monsters,
                    powerups: this.game.powerUps
                };
                this.socket.send(JSON.stringify(outgoingData));
            }
        }
    }

    // Add new method for player hits
    sendPlayerHit(targetPlayerId, damage) {
        if (this.connected && this.socket && this.socket.readyState === WebSocket.OPEN) {
            const hitData = {
                type: "player_hit",
                targetId: targetPlayerId,
                damage: damage,
                sourceId: this.playerId
            };
            this.socket.send(JSON.stringify(hitData));
        }
    }

    // Add new method for immediate powerup updates
    sendPowerUpUpdate() {
        if (this.connected && this.socket && this.socket.readyState === WebSocket.OPEN) {
            const powerUpData = {
                type: "powerup_update",
                powerups: this.game.powerUps
            };
            this.socket.send(JSON.stringify(powerUpData));
        }
    }
}

export { NetworkManager }; 
// Game constants
export const WIDTH = 1200;
export const HEIGHT = 800;
export const MAP_SIZE = 16;
export const TILE_SIZE = 64;

// Colors
export const COLORS = {
    BLACK: '#000000',
    WHITE: '#FFFFFF',
    RED: '#FF0000',
    GREEN: '#00FF00',
    BLUE: '#0000FF',
    GRAY: '#646464',
    YELLOW: '#FFFF00',
    CYAN: '#00FFFF',
    MAGENTA: '#FF00FF',
    DARK_GRAY: '#323232',
    BROWN: '#8B4513',
    ORANGE: '#FFA500',
    PURPLE: '#800080'
};

// Game settings
export const PLAYER_SETTINGS = {
    SPEED: 3,
    INITIAL_HEALTH: 100,
    INITIAL_SCORE: 0
};

// Weapon settings
export const WEAPONS = ['Pistol', 'Shotgun', 'Plasma Gun'];

// Raycasting settings
export const RAY_SETTINGS = {
    FOV: Math.PI / 3,
    HALF_FOV: Math.PI / 6,
    CASTED_RAYS: 240,
    STEP_ANGLE: (Math.PI / 3) / 240,
    MAX_DEPTH: 1200
};

// Monster settings
export const MONSTER_SETTINGS = {
    MAX_MONSTERS: 10,
    SHOOT_COOLDOWN: 100,
    BULLET_SPEED: 10,
    BULLET_DAMAGE: 10
};

// Powerup settings
export const POWERUP_SETTINGS = {
    MAX_POWERUPS: 10
};

// Asset paths (matching assetLoader.js). HUD weapons: 3 transparent PNGs each (from tools/process_doom_weapon_jpegs.py).
export const ASSETS = {
    IMAGES: {},
    WEAPON_FRAMES: {
        pistol: [
            'assets/weapons/doom/pistol_0.png',
            'assets/weapons/doom/pistol_1.png',
            'assets/weapons/doom/pistol_2.png'
        ],
        machinegun: [
            'assets/weapons/doom/machinegun_0.png',
            'assets/weapons/doom/machinegun_1.png',
            'assets/weapons/doom/machinegun_2.png'
        ],
        plasma: [
            'assets/weapons/doom/plasma_0.png',
            'assets/weapons/doom/plasma_1.png',
            'assets/weapons/doom/plasma_2.png'
        ]
    },
    SPRITE_MANIFEST: 'assets/better/sprites.json',
    SOUNDS: {
        shoot: 'assets/shoot.wav',
        hit: 'assets/hit.wav'
    }
};

// 3D rendering constants
export const RENDER_SETTINGS = {
    SCREEN_DIST: 416,
    SCALE: 150,
    H_WIDTH: WIDTH / 2,
    H_HEIGHT: HEIGHT / 2,
    MINIMAP_SCALE: 0.2
};

// Export for ES6 modules if needed
if (typeof module !== 'undefined') {
    module.exports = {
        WIDTH,
        HEIGHT,
        MAP_SIZE,
        TILE_SIZE,
        FOV: RAY_SETTINGS.FOV,
        CASTED_RAYS: RAY_SETTINGS.CASTED_RAYS,
        MAX_DEPTH: RAY_SETTINGS.MAX_DEPTH,
        MAX_MONSTERS: MONSTER_SETTINGS.MAX_MONSTERS,
        MAX_POWERUPS: POWERUP_SETTINGS.MAX_POWERUPS,
        COLORS
    };
} 
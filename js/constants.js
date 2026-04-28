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

/** Cycle order (HUD keys match WEAPON_FRAMES). Stats applied in main.js */
export const WEAPON_ORDER = [
    'pistol',
    'shotgun',
    'super_shotgun',
    'chaingun',
    'rocket',
    'plasma',
    'bfg',
    'chainsaw',
    'fist'
];

/**
 * range = max hit distance (same units as player/monster x,y).
 * coneHalf = aim tolerance radians (wider for shotguns & melee).
 * cooldownFrames = ticks before next shot (weaponHudFrameIndex uses this for 3-frame cycle).
 */
export const WEAPON_DEFINITIONS = {
    pistol: {
        label: 'Pistol',
        damage: 14,
        range: 9,
        coneHalf: Math.PI / 6,
        spread: 0.015,
        cooldownFrames: 12,
        ammoPerShot: 1,
        crosshairColor: '#66FF66',
        crosshairSize: 10
    },
    shotgun: {
        label: 'Shotgun',
        damage: 32,
        range: 5.5,
        coneHalf: Math.PI / 4.2,
        spread: 0.06,
        cooldownFrames: 26,
        ammoPerShot: 2,
        crosshairColor: '#FFAA44',
        crosshairSize: 16
    },
    super_shotgun: {
        label: 'Super Shotgun',
        damage: 48,
        range: 4.2,
        coneHalf: Math.PI / 4,
        spread: 0.09,
        cooldownFrames: 34,
        ammoPerShot: 4,
        crosshairColor: '#CC8844',
        crosshairSize: 18
    },
    chaingun: {
        label: 'Chaingun',
        damage: 9,
        range: 10,
        coneHalf: Math.PI / 7,
        spread: 0.04,
        cooldownFrames: 6,
        ammoPerShot: 1,
        crosshairColor: '#FFFF66',
        crosshairSize: 14
    },
    rocket: {
        label: 'Rocket Launcher',
        damage: 95,
        range: 16,
        coneHalf: Math.PI / 8,
        spread: 0.02,
        cooldownFrames: 42,
        ammoPerShot: 5,
        crosshairColor: '#FF6644',
        crosshairSize: 22
    },
    plasma: {
        label: 'Plasma Gun',
        damage: 22,
        range: 11,
        coneHalf: Math.PI / 6.5,
        spread: 0.06,
        cooldownFrames: 14,
        ammoPerShot: 2,
        crosshairColor: '#44FFFF',
        crosshairSize: 18
    },
    bfg: {
        label: 'BFG 9000',
        damage: 88,
        range: 12,
        coneHalf: Math.PI / 5.5,
        spread: 0.08,
        cooldownFrames: 72,
        ammoPerShot: 8,
        crosshairColor: '#66FF66',
        crosshairSize: 28
    },
    chainsaw: {
        label: 'Chainsaw',
        damage: 20,
        range: 1.75,
        coneHalf: Math.PI / 3,
        spread: 0,
        cooldownFrames: 5,
        ammoPerShot: 0,
        crosshairColor: '#CC3333',
        crosshairSize: 12
    },
    fist: {
        label: 'Fist',
        damage: 12,
        range: 1.05,
        coneHalf: Math.PI / 2.8,
        spread: 0,
        cooldownFrames: 20,
        ammoPerShot: 0,
        crosshairColor: '#AAAAAA',
        crosshairSize: 14
    }
};

export const WEAPONS = WEAPON_ORDER.map((k) => WEAPON_DEFINITIONS[k].label);

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

// Asset paths (matching assetLoader.js). HUD: 3 PNGs each — slice_hud_weapon_atlas.py from BEDB6217 atlas (9 weapon columns × 3 frames).
export const ASSETS = {
    IMAGES: {},
    WEAPON_FRAMES: {
        pistol: [
            'assets/weapons/hud_atlas/pistol_0.png',
            'assets/weapons/hud_atlas/pistol_1.png',
            'assets/weapons/hud_atlas/pistol_2.png'
        ],
        chaingun: [
            'assets/weapons/hud_atlas/chaingun_0.png',
            'assets/weapons/hud_atlas/chaingun_1.png',
            'assets/weapons/hud_atlas/chaingun_2.png'
        ],
        plasma: [
            'assets/weapons/hud_atlas/plasma_0.png',
            'assets/weapons/hud_atlas/plasma_1.png',
            'assets/weapons/hud_atlas/plasma_2.png'
        ],
        shotgun: [
            'assets/weapons/hud_atlas/shotgun_0.png',
            'assets/weapons/hud_atlas/shotgun_1.png',
            'assets/weapons/hud_atlas/shotgun_2.png'
        ],
        super_shotgun: [
            'assets/weapons/hud_atlas/super_shotgun_0.png',
            'assets/weapons/hud_atlas/super_shotgun_1.png',
            'assets/weapons/hud_atlas/super_shotgun_2.png'
        ],
        rocket: [
            'assets/weapons/hud_atlas/rocket_0.png',
            'assets/weapons/hud_atlas/rocket_1.png',
            'assets/weapons/hud_atlas/rocket_2.png'
        ],
        bfg: [
            'assets/weapons/hud_atlas/bfg_0.png',
            'assets/weapons/hud_atlas/bfg_1.png',
            'assets/weapons/hud_atlas/bfg_2.png'
        ],
        chainsaw: [
            'assets/weapons/hud_atlas/chainsaw_0.png',
            'assets/weapons/hud_atlas/chainsaw_1.png',
            'assets/weapons/hud_atlas/chainsaw_2.png'
        ],
        fist: [
            'assets/weapons/hud_atlas/fist_0.png',
            'assets/weapons/hud_atlas/fist_1.png',
            'assets/weapons/hud_atlas/fist_2.png'
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
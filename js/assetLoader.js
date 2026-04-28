import { ASSETS } from './constants.js';

/**
 * Loads assets/better/sprites.json (v2: labeled PNG paths per clip).
 * No runtime atlas slicing — frames are pre-exported by tools/export_sprite_atlases.py
 */
class AssetLoader {
    constructor() {
        this.images = {};
        this.sounds = {};
        this.totalAssets = 0;
        this.loadedAssets = 0;
        /** @type {object|null} */
        this.spriteManifest = null;
        /** @type {Record<string, Record<string, HTMLImageElement[]>>} */
        this.monsterClips = {};
        /** @type {Record<string, HTMLImageElement[]>} */
        this.playerClips = { walk: [] };
        /** @type {Record<string, HTMLImageElement>} */
        this.namedImages = {};
        /** @type {Record<string, HTMLImageElement[]>} three HUD frames per weapon key */
        this.weaponFrames = {};
    }

    loadImage(key, src) {
        this.totalAssets++;
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.images[key] = img;
                this.loadedAssets++;
                resolve(img);
            };
            img.onerror = reject;
            img.src = src;
        });
    }

    loadSound(key, src) {
        this.totalAssets++;
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.oncanplaythrough = () => {
                this.sounds[key] = audio;
                this.loadedAssets++;
                resolve(audio);
            };
            audio.onerror = reject;
            audio.src = src;
        });
    }

    /**
     * @param {string} name - wallTile | healthPickup | ammoPickup
     * @returns {{ img: HTMLImageElement, rect: { sx: number, sy: number, sw: number, sh: number } } | null}
     */
    getNamedFrame(name) {
        const img = this.namedImages[name];
        if (!img || !img.complete) return null;
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        return { img, rect: { sx: 0, sy: 0, sw: w, sh: h } };
    }

    /** @param {string} monsterKey - monster1 | monster2 | monster3 */
    getMonsterClip(monsterKey, state) {
        const m = this.monsterClips[monsterKey];
        return m && m[state] ? m[state] : null;
    }

    collectManifestPaths() {
        const paths = new Set();
        const m = this.spriteManifest;
        if (!m || m.version !== 2) {
            throw new Error('Expected sprite manifest version 2 with labeled PNG paths');
        }
        for (const mk of Object.keys(m.clips)) {
            const clips = m.clips[mk];
            for (const arr of Object.values(clips)) {
                arr.forEach((p) => paths.add(p));
            }
        }
        if (m.player && m.player.walk) {
            m.player.walk.forEach((p) => paths.add(p));
        }
        if (m.named) {
            Object.values(m.named).forEach((p) => paths.add(p));
        }
        return [...paths];
    }

    async loadSpriteManifest() {
        const res = await fetch(ASSETS.SPRITE_MANIFEST);
        if (!res.ok) {
            throw new Error(`Sprite manifest failed: ${ASSETS.SPRITE_MANIFEST}`);
        }
        this.spriteManifest = await res.json();

        const paths = this.collectManifestPaths();
        await Promise.all(paths.map((p) => this.loadImage(p, p)));

        this.monsterClips = {};
        for (const mk of Object.keys(this.spriteManifest.clips)) {
            this.monsterClips[mk] = {};
            const c = this.spriteManifest.clips[mk];
            for (const state of Object.keys(c)) {
                this.monsterClips[mk][state] = c[state].map((p) => this.images[p]);
            }
        }

        this.playerClips.walk = this.spriteManifest.player.walk.map((p) => this.images[p]);

        const n = this.spriteManifest.named;
        this.namedImages.wallTile = this.images[n.wallTile];
        this.namedImages.healthPickup = this.images[n.healthPickup];
        this.namedImages.ammoPickup = this.images[n.ammoPickup];
    }

    async loadWeaponFrames() {
        this.weaponFrames = {};
        const wf = ASSETS.WEAPON_FRAMES;
        if (!wf) return;
        for (const name of Object.keys(wf)) {
            const paths = wf[name];
            this.weaponFrames[name] = [];
            for (let i = 0; i < paths.length; i++) {
                const key = `weapon_${name}_${i}`;
                await this.loadImage(key, paths[i]);
                this.weaponFrames[name][i] = this.images[key];
            }
        }
    }

    async loadAll() {
        await this.loadSpriteManifest();
        await this.loadWeaponFrames();

        const assets = [
            ...Object.entries(ASSETS.IMAGES).map(([key, path]) => this.loadImage(key, path)),
            ...Object.entries(ASSETS.SOUNDS).map(([key, path]) => this.loadSound(key, path))
        ];

        await Promise.all(assets);
        console.log('All assets loaded');
    }
}

const assetLoader = new AssetLoader();
export { assetLoader };

import { ASSETS } from './constants.js';

class AssetLoader {
    constructor() {
        this.images = {};
        this.sounds = {};
        this.totalAssets = 0;
        this.loadedAssets = 0;
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

    async loadAll() {
        const assets = [
            ...Object.entries(ASSETS.IMAGES).map(([key, path]) => 
                this.loadImage(key, path)
            ),
            ...Object.entries(ASSETS.SOUNDS).map(([key, path]) => 
                this.loadSound(key, path)
            )
        ];

        await Promise.all(assets);
        console.log('All assets loaded');
    }
}

// Create global asset loader instance
const assetLoader = new AssetLoader();

// Export the instance
export { assetLoader }; 
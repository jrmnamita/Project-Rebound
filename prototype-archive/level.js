import { Platform, Spike } from './entities.js';

// Ito ang "arkitekto" ng ating game. Siya ang gumagawa ng mga sahig (platforms) habang tumatakbo tayo.
export class LevelGenerator {
    constructor(canvasWidth, canvasHeight) {
        this.width = canvasWidth;
        this.height = canvasHeight;
        this.platforms = []; // Listahan ng mga sahig
        this.spikes = [];    // Listahan ng mga tinik
        this.lastX = 0;
        this.lastY = canvasHeight - 150;
        this.minPlatformWidth = 300;
        this.maxPlatformWidth = 800;
        this.baseMinGap = 60;    // Pinakamaliit na distansya sa simula
        this.baseMaxGap = 140;   // Pinakamalaking distansya sa simula
        
        // Gawa muna tayo ng unang sahig para may matayuan ang bola sa start
        this.generatePlatform(0, this.lastY, 1200);
    }

    // Utos para gumawa ng isang pirasong sahig
    generatePlatform(x, y, width, angle = 0) {
        const platform = new Platform(x, y, width, 500, angle);
        this.platforms.push(platform);
        
        // I-save kung saan nagtapos ang sahig na ito para sa susunod na dugtong
        this.lastX = x + Math.cos(angle) * width;
        this.lastY = y + Math.sin(angle) * width;
        
        return platform;
    }

    // Tinatawag ito habang tumatakbo ang bola para magdagdag ng bagong sahig sa kanan
    update(ballX, score, currentSpeed) {
        // Burahin ang mga lumang sahig na wala na sa screen para hindi bumagal ang game
        this.platforms = this.platforms.filter(p => p.x + p.width > ballX - 1000);
        this.spikes = this.spikes.filter(s => s.x + s.width > ballX - 1000);

        // Pabilisin ang gaps habang bumibilis ang bola
        const speedFactor = currentSpeed / 4;
        const dynamicMaxGap = this.baseMaxGap * speedFactor;
        const dynamicMinGap = this.baseMinGap * speedFactor;

        // Habang malayo pa ang dulo, gawa lang tayo nang gawa ng bagong sahig
        while (this.lastX < ballX + this.width + 500) {
            const gap = dynamicMinGap + Math.random() * (dynamicMaxGap - dynamicMinGap);
            const nextX = this.lastX + gap;
            
            // Randomly baguhin ang taas/baba ng susunod na sahig
            let nextY = this.lastY + (Math.random() - 0.4) * 150; 
            
            // Siguraduhin na hindi lalabas sa screen ang sahig
            if (nextY < 200) nextY = 200;
            if (nextY > this.height - 100) nextY = this.height - 100;

            const width = this.minPlatformWidth + Math.random() * (this.maxPlatformWidth - this.minPlatformWidth);
            
            // Random angle: Minsan tabingi ang sahig para mas mahirap
            const angle = (Math.random() * 0.15); 
            
            const p = this.generatePlatform(nextX, nextY, width, angle);

            // Magdagdag ng mga tinik (spikes) depende sa score
            if (score > 500) {
                this.maybeAddSpikes(p, score);
            }
        }

        // Igalaw ang mga moving spikes
        this.spikes.forEach(s => s.update());
    }

    // Desisyon kung maglalagay ba ng tinik sa sahig na ito
    maybeAddSpikes(platform, score) {
        // May 40% chance na magkaroon ng tinik
        if (Math.random() < 0.4) {
            // Kapag high score na (>1500), may chance na gumagalaw ang tinik
            const type = score > 1500 && Math.random() < 0.3 ? 'moving' : 'static';
            const spikeX = platform.x + 100 + Math.random() * (platform.width - 200);
            const spikeY = platform.y - 40;
            this.spikes.push(new Spike(spikeX, spikeY, type));
        }
    }

    // Drawing ng lahat ng sahig at tinik na kasalukuyang active
    draw(ctx, cameraX) {
        this.platforms.forEach(p => p.draw(ctx));
        this.spikes.forEach(s => s.draw(ctx));
    }
}

// Ito ang background na gumagalaw nang mabagal (Parallax Effect)
// Parang kapag nakasakay ka sa kotse, yung bundok sa malayo ay mabagal ang galaw.
export class ParallaxLayer {
    constructor(imageSrc, speed, canvasWidth, canvasHeight) {
        this.img = new Image();
        this.img.src = imageSrc;
        this.speed = speed; // Bilis ng galaw ng background
        this.width = canvasWidth;
        this.height = canvasHeight;
        this.loaded = false;
        this.img.onload = () => this.loaded = true; // Hintayin matapos ang loading ng picture
    }

    draw(ctx, cameraX) {
        if (!this.loaded) return;
        
        // I-calculate kung nasaan na dapat ang background
        const x = -(cameraX * this.speed) % this.width;
        
        // I-drawing ang background nang dalawang beses para maging "infinite" o walang putol
        ctx.drawImage(this.img, x, 0, this.width, this.height);
        ctx.drawImage(this.img, x + this.width, 0, this.width, this.height);
    }
}

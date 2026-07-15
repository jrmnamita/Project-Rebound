import { CONFIG } from './physics.js';

// Ito ang ating Main Character (yung pulang bola)
export class Ball {
    constructor(x, y) {
        this.x = x;           // Posisyon sa kaliwa/kanan
        this.y = y;           // Posisyon sa taas/baba
        this.vx = CONFIG.INITIAL_SPEED; // Magsimula sa mabagal na takbo
        this.vy = 0;          // Bilis ng pagtalon o pagbagsak
        this.radius = CONFIG.BALL_RADIUS; // Laki ng bola
        this.onGround = false; // Naka-apak ba sa lupa?
        this.isJumping = false; // Naka-hold ba ang jump?
        
        // Mga visual settings para magmukhang buhay yung bola
        this.rotation = 0;    // Pag-ikot ng bola habang tumatakbo
        this.scaleX = 1;      // Lapad ng bola (ginagamit para sa "squash" effect)
        this.scaleY = 1;      // Taas ng bola (ginagamit para sa "stretch" effect)
        this.targetScaleX = 1;
        this.targetScaleY = 1;
        this.dead = false;    // Patay na ba ang bola?
        this.popProgress = 0; // Animation kapag "pumutok" ang bola
    }

    // Dito kinacalculate ang galaw ng bola bawat segundo
    update() {
        if (this.dead) {
            this.popProgress += 0.05; // Kapag patay, ituloy ang "pop" animation
            return;
        }

        // Apply gravity: Hilahin ang bola pababa
        this.vy += CONFIG.GRAVITY;
        if (this.vy > CONFIG.MAX_VELOCITY_Y) this.vy = CONFIG.MAX_VELOCITY_Y;

        this.x += this.vx; // Igalaw pakanan
        this.y += this.vy; // Igalaw pataas o pababa

        // Paikutin ang bola depende sa bilis ng takbo
        this.rotation += this.vx * 0.05;

        // Squash and Stretch: Parang rubber ball na napipitpit kapag tumatama o tumatalon
        if (!this.onGround) {
            // Humahaba (stretch) habang nahuhulog o tumatalon
            const stretch = Math.min(Math.abs(this.vy) * CONFIG.SQUASH_STRETCH_INTENSITY * 0.1, 0.3);
            this.targetScaleY = 1 + stretch;
            this.targetScaleX = 1 - stretch;
        } else {
            // Napipitpit (squash) nang konti kapag nasa lupa
            this.targetScaleX = 1.1;
            this.targetScaleY = 0.9;
        }

        // Smoothly interpolate scales
        this.scaleX += (this.targetScaleX - this.scaleX) * 0.2;
        this.scaleY += (this.targetScaleY - this.scaleY) * 0.2;
        
        // Return target scales to normal
        this.targetScaleX = 1;
        this.targetScaleY = 1;
    }

    // Ito ang nagdodrowing (rendering) ng bola sa screen
    draw(ctx) {
        if (this.dead && this.popProgress >= 1) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        
        if (this.dead) {
            // Popping animation
            const burst = this.popProgress * 2;
            ctx.scale(1 + burst, 1 + burst);
            ctx.globalAlpha = 1 - this.popProgress;
        } else {
            ctx.rotate(this.rotation);
            ctx.scale(this.scaleX, this.scaleY);
        }

        // Draw Ball Body
        const gradient = ctx.createRadialGradient(-this.radius * 0.3, -this.radius * 0.3, 0, 0, 0, this.radius);
        gradient.addColorStop(0, CONFIG.COLORS.RED_LIGHT);
        gradient.addColorStop(1, CONFIG.COLORS.RED_DARK);

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Dark outline
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Glossy Highlight
        ctx.beginPath();
        ctx.ellipse(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.4, this.radius * 0.2, -Math.PI/4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fill();

        ctx.restore();
    }

    // Kapag pinindot ang Jump (Space/Click), ito ang tatawagin
    jump() {
        if (this.onGround) { // Pwede lang tumalon kung nakatapak sa lupa
            this.vy = CONFIG.JUMP_FORCE; // Bigyan ng lakas pataas
            this.onGround = false;
            this.isJumping = true; // Markahan na nag-uumpisa ang talon
            
            // Squash effect para may "bounce" feel
            this.scaleX = 1.3;
            this.scaleY = 0.7;
        }
    }

    // Kapag binitawan ang pindot, hihina ang talon (Variable Jump)
    cancelJump() {
        if (this.isJumping && this.vy < CONFIG.MIN_JUMP_FORCE) {
            this.vy = CONFIG.MIN_JUMP_FORCE; // Putulin ang taas ng talon
        }
        this.isJumping = false;
    }
}

// Ito ang mga sahig o platforms na tinatalunan ng bola
export class Platform {
    constructor(x, y, width, height, angle = 0) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.angle = angle; // Angle: kung gaano katabingi ang sahig (Slope)
    }

    // Drawing ng sahig (Lupa sa baba, Damo sa itaas)
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle); // I-rotate kung tabingi ang sahig
        
        // Katawan ng lupa (Dirt)
        ctx.fillStyle = CONFIG.COLORS.DIRT;
        ctx.fillRect(0, 0, this.width, this.height);

        // Itaas na bahagi (Damo/Grass)
        ctx.fillStyle = CONFIG.COLORS.GRASS;
        ctx.fillRect(0, 0, this.width, 15);
        
        // Guhit sa pagitan ng damo at lupa
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 15);
        ctx.lineTo(this.width, 15);
        ctx.stroke();

        // Outline para malinaw ang gilid
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, this.width, this.height);

        ctx.restore();
    }
}

// Ito ang maliliit na "alikabok" o effects kapag tumatama ang bola
export class Particle {
    constructor(x, y, color, speed = 5) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * speed; // Random na galaw pakaliwa/kanan
        this.vy = (Math.random() - 0.5) * speed - 2; // Random na galaw pataas/pababa
        this.radius = Math.random() * 5 + 2; // Random na laki
        this.color = color;
        this.life = 1.0; // Life: Unti-unting nawawala (fade out)
        this.decay = Math.random() * 0.02 + 0.01; // Gaano kabilis mawala
    }

    // Galaw ng alikabok (lilipad at unti-unting mahuhulog)
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1; // Gravity para sa alikabok
        this.life -= this.decay; // Unti-unting naglalaho
    }

    // Drawing ng maliit na bilog para sa alikabok
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life; // Kapal ng kulay (Opacity)
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Ito ang mga tinik o kalaban. Kapag tinamaan, "pop" ang bola!
export class Spike {
    constructor(x, y, type = 'static') {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 40;
        this.type = type; // 'static' (hindi nagalaw) o 'moving' (pabalik-balik)
        this.vx = type === 'moving' ? -2 : 0;
        this.initialX = x;
    }

    // Galaw ng tinik (kung moving type siya)
    update() {
        if (this.type === 'moving') {
            this.x += this.vx; // Igalaw pakaliwa
        }
    }

    // Drawing ng tatsulok (Triangle) na tinik
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.beginPath();
        ctx.moveTo(0, this.height);         // Simula sa kaliwang baba
        ctx.lineTo(this.width / 2, 0);      // Punta sa gitnang taas
        ctx.lineTo(this.width, this.height); // Punta sa kanang baba
        ctx.closePath();

        // Kulay na gray na may gradient para magmukhang bakal
        const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, '#94a3b8');
        gradient.addColorStop(1, '#475569');
        
        ctx.fillStyle = gradient;
        ctx.fill();
        
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.restore();
    }
}

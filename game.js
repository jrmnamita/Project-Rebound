import { Ball } from './entities.js';
import { LevelGenerator, ParallaxLayer } from './level.js';
import { checkCollision, CONFIG } from './physics.js';

// Ito ang "Utak" ng buong game. Dito pinagsasama-sama ang lahat.
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas'); // Ang drawing board natin
        this.ctx = this.canvas.getContext('2d');           // Ang paintbrush natin
        this.scoreVal = document.getElementById('score-val');
        this.bestVal = document.getElementById('best-val');
        this.phaseText = document.getElementById('phase-text');
        this.startScreen = document.getElementById('start-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        
        // I-resize ang canvas para sakto sa screen
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.init(); // Simulan ang mga settings
        this.particles = [];
        this.screenShake = 0;
        this.setupInputs(); // Makinig sa pindot ng player
        this.loop(); // Simulan ang heartbeat ng game
    }

    // Dito sine-set up ang bagong game (Reset)
    init() {
        this.state = 'MENU'; // Sa simula, nasa Menu muna
        this.score = 0;
        
        // Kunin ang High Score sa memory ng browser
        this.best = parseInt(localStorage.getItem('bounce-best') || 0);
        this.bestVal.textContent = this.best.toString().padStart(4, '0');
        
        this.cameraX = 0; // Camera position
        this.ball = new Ball(200, 300); // Gawa ng bagong bola
        this.level = new LevelGenerator(this.canvas.width, this.canvas.height); // Gawa ng level
        this.parallax = new ParallaxLayer('bg.png', 0.2, this.canvas.width, this.canvas.height); // Background
        
        this.phase = 1; // Unang level ng hirap
        this.phaseText.textContent = 'PHASE 1';
        this.scoreVal.textContent = '0000';
    }

    resize() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }

    // Dito tayo nakikinig kung may pinindot ang user
    setupInputs() {
        const handleJumpStart = () => {
            if (this.state === 'PLAYING') {
                this.ball.jump(); // Tumalon!
            } else if (this.state === 'MENU') {
                this.start();     // Simulan ang laro!
            }
        };

        const handleJumpEnd = () => {
            if (this.state === 'PLAYING') {
                this.ball.cancelJump(); // Hinaan ang talon kapag binitawan
            }
        };

        // Keyboard inputs
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') handleJumpStart();
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') handleJumpEnd();
        });

        // Mouse inputs
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) handleJumpStart();
        });
        window.addEventListener('mouseup', handleJumpEnd);

        // Touch inputs (for mobile) - Gamit ang preventDefault para walang delay
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleJumpStart();
        }, { passive: false });
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleJumpEnd();
        }, { passive: false });

        // Mga buttons sa screen
        document.getElementById('start-btn').addEventListener('click', () => this.start());
        document.getElementById('restart-btn').addEventListener('click', () => {
            this.gameOverScreen.classList.add('hidden');
            this.init();
            this.start();
        });
    }

    start() {
        this.state = 'PLAYING';
        this.startScreen.classList.add('hidden');
    }

    die() {
        if (this.state === 'DYING') return;
        this.state = 'DYING';
        this.ball.dead = true;
        this.screenShake = 20;

        // Spawn many particles for "pop"
        for (let i = 0; i < 30; i++) {
            this.particles.push(new Particle(this.ball.x, this.ball.y, CONFIG.COLORS.RED, 8));
        }

        if (this.score > this.best) {
            this.best = Math.floor(this.score);
            localStorage.setItem('bounce-best', this.best);
        }
        
        setTimeout(() => {
            this.showGameOver();
        }, 1500);
    }

    showGameOver() {
        this.state = 'GAMEOVER';
        document.getElementById('final-score-val').textContent = Math.floor(this.score);
        document.getElementById('final-best-val').textContent = this.best;
        this.gameOverScreen.classList.remove('hidden');
    }

    // Dito kinacalculate ang lahat ng logic (Galaw, Banggaan, Score)
    update() {
        if (this.state !== 'PLAYING' && this.state !== 'DYING') return;

        this.ball.update(); // Igalaw ang bola

        if (this.state === 'PLAYING') {
            // Dagdagan ang score habang tumatakbo
            this.score += 0.1;
            const currentScore = Math.floor(this.score);
            this.scoreVal.textContent = currentScore.toString().padStart(4, '0');
            
            // Speed Progression: Pabilis nang pabilis habang lumalaki ang score
            // Magsisimula sa INITIAL_SPEED (4) at lalapit sa MAX_SPEED (10)
            const speedMultiplier = Math.min(currentScore / 2000, 1); // Max speed reached at 2000 score
            this.ball.vx = CONFIG.INITIAL_SPEED + (CONFIG.MAX_SPEED - CONFIG.INITIAL_SPEED) * speedMultiplier;

            // Pahayag kung anong Phase na (pahirap nang pahirap)
            if (currentScore > 500 && this.phase === 1) {
                this.phase = 2;
                this.phaseText.textContent = 'PHASE 2';
                this.phaseText.style.color = '#fbbf24';
            } else if (currentScore > 1500 && this.phase === 2) {
                this.phase = 3;
                this.phaseText.textContent = 'PHASE 3';
                this.phaseText.style.color = '#f87171';
            }

            // Igalaw ang camera para sumunod sa bola
            this.cameraX = this.ball.x - 200;

            // Gawa ng bagong level sa kanan
            this.level.update(this.ball.x, this.score, this.ball.vx);

            // Collision: Chine-check kung nakatapak ang bola sa sahig
            this.ball.onGround = false;
            
            for (const platform of this.level.platforms) {
                const collision = checkCollision(this.ball, platform);
                if (collision.collided) {
                    // Kung bumabagsak ang bola at tumama sa ibabaw ng platform
                    if (this.ball.vy > 0 && collision.localY < 20) {
                        const cos = Math.cos(platform.angle);
                        const sin = Math.sin(platform.angle);
                        
                        // I-adjust ang position para hindi bumaon ang bola
                        this.ball.y = platform.y + (this.ball.x - platform.x) * (sin/cos) - this.ball.radius;
                        this.ball.vy = 0;
                        
                        if (!this.ball.onGround) {
                            // Konting effect kapag lumapag
                            for(let i=0; i<5; i++) this.particles.push(new Particle(this.ball.x, this.ball.y, CONFIG.COLORS.GRASS, 2));
                        }
                        this.ball.onGround = true;

                        // Slope pull: itinutulak ang bola kapag tabingi ang lupa
                        // Dinagdagan natin ng vx check para hindi masyadong mabilis sa slope
                        this.ball.vx += sin * 0.5;
                    } else if (collision.localY > 20) {
                        // Kung tumama sa gilid, PATAY!
                        this.die();
                    }
                }
            }

            // Update particles (alikabok effects)
            this.particles = this.particles.filter(p => {
                p.update();
                return p.life > 0;
            });

            // Yanig ng screen decay
            if (this.screenShake > 0) this.screenShake *= 0.9;

            // Collision sa mga tinik (Spikes)
            for (const spike of this.level.spikes) {
                const dist = Math.hypot(this.ball.x - (spike.x + spike.width/2), this.ball.y - (spike.y + spike.height/2));
                if (dist < this.ball.radius + 15) {
                    this.die(); // PATAY!
                }
            }

            // Kapag nahulog sa bangin, PATAY!
            if (this.ball.y > this.canvas.height + 100) {
                this.die();
            }
        }
    }

    // Dito idodrowing ang lahat ng visuals sa screen
    draw() {
        this.ctx.save();
        if (this.screenShake > 0) {
            // Yanigin ang screen kung may screenShake
            this.ctx.translate((Math.random() - 0.5) * this.screenShake, (Math.random() - 0.5) * this.screenShake);
        }

        this.ctx.clearRect(-100, -100, this.canvas.width + 200, this.canvas.height + 200);
        
        // Drawing order: Background muna bago ang mga objects
        this.parallax.draw(this.ctx, this.cameraX);

        this.ctx.save();
        this.ctx.translate(-this.cameraX, 0); // I-follow ang camera sa bola
        
        // Level
        this.level.draw(this.ctx, this.cameraX);

        // Particles
        this.particles.forEach(p => p.draw(this.ctx));

        // Ball
        this.ball.draw(this.ctx);

        this.ctx.restore();
        this.ctx.restore();
    }

    // Ito ang "Heartbeat" ng game. Tuloy-tuloy itong tumatakbo.
    loop() {
        this.update(); // Calculate logic
        this.draw();   // Drawing visuals
        requestAnimationFrame(() => this.loop()); // Ulitin uli sa susunod na frame
    }
}

new Game();

// Dito nakalagay ang mga settings ng game natin.
export const CONFIG = {
    GRAVITY: 0.6,               // Hatak ng lupa pababa
    JUMP_FORCE: -12,            // Lakas ng talon (pinaliit nang konti para sa variable jump)
    MIN_JUMP_FORCE: -6,         // Minimum na lakas kung binitawan agad ang pindot
    INITIAL_SPEED: 4,           // Bagal ng simula (dati ay 6, ginawa nating 4)
    MAX_SPEED: 10,              // Pinakamabilis na takbo sa dulo
    MAX_VELOCITY_Y: 20,         // Pinakamabilis na pagbagsak
    FRICTION: 0.98,
    BALL_RADIUS: 25,
    SQUASH_STRETCH_INTENSITY: 0.2,
    COLORS: {
        RED: '#ff3e3e',
        RED_LIGHT: '#ff6b6b',
        RED_DARK: '#c02d2d',
        GRASS: '#4ade80',
        DIRT: '#7c2d12',
        SKY: '#70d6ff'
    }
};

// Ito ay helper para sa pag-track ng position (X at Y coordinates)
export class Vector {
    constructor(x, y) {
        this.x = x; // Horizontal position (kaliwa o kanan)
        this.y = y; // Vertical position (taas o baba)
    }
}

// Ito ang "mata" ng game. Chine-check nito kung tumama ba ang bola sa sahig o platform.
export function checkCollision(ball, platform) {
    // Kinukuha natin ang distansya ng bola sa platform
    const dx = ball.x - platform.x;
    const dy = ball.y - platform.y;
    
    // Dahil may mga pa-slant o tabingi na sahig, kailangan natin ng Math (Sin/Cos)
    const cos = Math.cos(-platform.angle);
    const sin = Math.sin(-platform.angle);
    
    // I-rotate natin ang calculation para malaman kung nasa loob ba ng box ng platform ang bola
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    // Hanapin ang pinakamalapit na punto sa platform papunta sa bola
    const closestX = Math.max(0, Math.min(localX, platform.width));
    const closestY = Math.max(0, Math.min(localY, platform.height));

    // Distansya mula sa pinakamalapit na punto
    const distDX = localX - closestX;
    const distDY = localY - closestY;
    const distanceSquared = (distDX * distDX) + (distDY * distDY);

    // Kapag mas maliit ang distansya kaysa sa radius ng bola, ibig sabihin TUMAMA (Collision!)
    if (distanceSquared < (ball.radius * ball.radius)) {
        return {
            collided: true,
            platform,
            localY,
            distDY
        };
    }
    return { collided: false }; // Walang tama
}

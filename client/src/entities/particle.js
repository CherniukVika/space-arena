import { Vector2 } from "../math/vector2.js";
import { Entity } from "./entity.js";

export class Particle extends Entity {
	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number} vx
	 * @param {number} vy
	 * @param {number} [life=0.6]
	 */
	constructor(x, y, vx, vy, life = 0.6) {
		super({ x, y, vx, vy, radius: 2, kind: "particle" });
		this.life = life;
		this.maxLife = life;
	}

	update(dt) {
		this.life -= dt;
		if (this.life <= 0) {
			this.markDead();
			return;
		}
		this.prevPos = this.pos.clone();
		this.pos = this.pos.add(this.vel.scale(dt));
		this.vel = this.vel.scale(0.92); // гасіння
	}
}

/** Створити хмару частинок у точці. */
export function spawnExplosion(world, x, y, count = 14) {
	for (let i = 0; i < count; i++) {
		const a = Math.random() * Math.PI * 2;
		const sp = 80 + Math.random() * 180;
		const v = Vector2.fromAngle(a, sp);
		world.spawn(new Particle(x, y, v.x, v.y, 0.4 + Math.random() * 0.5));
	}
}

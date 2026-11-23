import { Vector2 } from "../math/vector2.js";
import { Entity } from "./entity.js";

export class Asteroid extends Entity {
	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number} [radius=28]
	 */
	constructor(x, y, radius = 28) {
		const angle = Math.random() * Math.PI * 2;
		const speed = 40 + Math.random() * 60;
		const vel = Vector2.fromAngle(angle, speed);
		super({
			x,
			y,
			vx: vel.x,
			vy: vel.y,
			radius,
			kind: "asteroid",
		});
		this.spin = (Math.random() - 0.5) * 2;
	}

	update(dt, world) {
		this.prevPos = this.pos.clone();
		this.prevAngle = this.angle;
		this.angle += this.spin * dt;
		this.pos = this.pos.add(this.vel.scale(dt));
		// wrap зробить World або окрема система; поки тут:
		// (передамо arena пізніше або зробимо в World)
	}
}

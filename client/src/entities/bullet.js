import { Homing } from "../components/homing.js";
import { Entity } from "./entity.js";

const TTL = 1.4; // секунди життя кулі

export class Bullet extends Entity {
	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number} vx
	 * @param {number} vy
	 * @param {number} ownerId — id корабля, щоб не бити себе
	 * @param {object} [opts]
	 * @param {boolean} [opts.homing=false]
	 */
	constructor(x, y, vx, vy, ownerId, { homing = false } = {}) {
		super({ x, y, vx, vy, radius: 4, kind: "bullet" });
		this.ownerId = ownerId;
		this.ttl = TTL;
		/** @type {Homing | null} */
		this.homing = homing ? new Homing({ turnRate: 4, maxSpeed: 480 }) : null;
	}

	/**
	 * @param {number} dt
	 * @param {import('../world.js').World} world
	 */
	update(dt, world) {
		this.ttl -= dt;
		if (this.ttl <= 0) {
			this.markDead();
			return;
		}

		// композиція: homing оновлює vel, якщо є
		if (this.homing) {
			this.homing.apply(this, world, dt);
		}

		super.update(dt, world);
	}
}

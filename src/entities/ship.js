import { Vector2 } from "../math/vector2.js";
import { Bullet } from "./bullet.js";
import { Entity } from "./entity.js";

const TURN_SPEED = 3.5;
const THRUST = 220;
const DRAG = 0.6;
const FIRE_COOLDOWN = 0.25; // сек
const BULLET_SPEED = 420;
const MAX_HP = 3;

export class Ship extends Entity {
	#hp;
	#fireCd = 0;
	#respawnTimer = 0; // >0 = чекаємо респаун

	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {object} [opts]
	 * @param {boolean} [opts.isPlayer=true]
	 */
	constructor(x, y, { isPlayer = true } = {}) {
		super({ x, y, radius: 18, kind: "ship" });
		this.#hp = MAX_HP;
		this.isPlayer = isPlayer;
		this.score = 0;
		this.invulnerable = 0; // сек після респауну
		this.homingShots = 0;
	}

	get hp() {
		return this.#hp;
	}

	get isAlive() {
		return this.#hp > 0 && this.#respawnTimer <= 0;
	}

	/**
	 * Викликається з main / input.
	 * @param {{ left: boolean, right: boolean, thrust: boolean, fire: boolean }} input
	 * @param {number} dt
	 * @param {import('../world.js').World} world
	 * @param {{ width: number, height: number }} arena
	 */
	update(dt, world, input, arena) {
		if (this.#respawnTimer > 0) {
			this.#respawnTimer -= dt;
			if (this.#respawnTimer <= 0) {
				this.#hp = MAX_HP;
				this.pos = new Vector2(arena.width / 2, arena.height / 2);
				this.vel = new Vector2(0, 0);
				this.angle = 0;
				this.invulnerable = 2;
				this.dead = false;
			}
			return;
		}

		if (this.invulnerable > 0) this.invulnerable -= dt;

		this.prevPos = this.pos.clone();
		this.prevAngle = this.angle;

		const turn = (input.right ? 1 : 0) - (input.left ? 1 : 0);
		this.angle += turn * TURN_SPEED * dt;

		if (input.thrust) {
			const force = Vector2.fromAngle(this.angle, THRUST * dt);
			this.vel = this.vel.add(force);
		}

		const k = Math.exp(-DRAG * dt);
		this.vel = this.vel.scale(k);

		this.pos = this.pos.add(this.vel.scale(dt));
		// wrap
		this.pos = new Vector2(
			((this.pos.x % arena.width) + arena.width) % arena.width,
			((this.pos.y % arena.height) + arena.height) % arena.height,
		);

		if (this.#fireCd > 0) this.#fireCd -= dt;
		if (input.fire && this.#fireCd <= 0) {
			this.fire(world);
			this.#fireCd = FIRE_COOLDOWN;
		}
	}

	/**
	 * Створює кулю з носа корабля.
	 * ВАЖЛИВО: this тут має бути Ship. Якщо передати ship.fire у addEventListener —
	 * this буде window/undefined → баг. Див. README.
	 * @param {import('../world.js').World} world
	 */
	fire(world) {
		if (!this.isAlive) return;
		const nose = this.pos.add(Vector2.fromAngle(this.angle, this.radius + 6));
		const vel = Vector2.fromAngle(this.angle, BULLET_SPEED).add(this.vel);
		const useHoming = (this.homingShots ?? 0) > 0;
		if (useHoming) this.homingShots -= 1;
		const bullet = new Bullet(nose.x, nose.y, vel.x, vel.y, this.id, {
			homing: useHoming,
		});
		world.spawn(bullet);
	}

	heal(amount = 1) {
		if (this.#respawnTimer > 0) return;
		this.#hp = Math.min(3, this.#hp + amount);
	}

	/** Отримати урон. */
	takeDamage(amount = 1) {
		if (this.invulnerable > 0 || this.#respawnTimer > 0) return;
		this.#hp -= amount;
		if (this.#hp <= 0) {
			this.#hp = 0;
			this.#respawnTimer = 2; // респаун через 2 с
			// вибух зробить World / collision system
		}
	}
}

import { Vector2 } from "../math/vector2.js";

/** Приватний лічильник id (один на весь модуль). */
let nextId = 1;

export class Entity {
	/** @type {number} */
	#id;

	/**
	 * @param {object} opts
	 * @param {number} opts.x
	 * @param {number} opts.y
	 * @param {number} [opts.vx=0]
	 * @param {number} [opts.vy=0]
	 * @param {number} [opts.radius=10]
	 * @param {string} [opts.kind='entity']
	 */
	constructor({ x, y, vx = 0, vy = 0, radius = 10, kind = "entity" }) {
		this.#id = nextId++;
		this.pos = new Vector2(x, y);
		this.vel = new Vector2(vx, vy);
		this.radius = radius;
		this.kind = kind;
		this.dead = false;

		// для інтерполяції рендеру
		this.prevPos = this.pos.clone();
		this.prevAngle = 0;
		this.angle = 0;
	}

	get id() {
		return this.#id;
	}

	/** Позначити «мертвим» — World прибере на кінці кроку. */
	markDead() {
		this.dead = true;
	}

	/**
	 * Базовий update: зберігає prev і рухає за vel.
	 * Підкласи / композиція можуть перевизначати.
	 * @param {number} dt
	 * @param {import('../world.js').World} _world
	 */
	update(dt, _world) {
		this.prevPos = this.pos.clone();
		this.prevAngle = this.angle;
		this.pos = this.pos.add(this.vel.scale(dt));
	}
}

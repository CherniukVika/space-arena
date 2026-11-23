import { Asteroid } from "./entities/asteroid.js";
import { spawnExplosion } from "./entities/particle.js";
import { Pickup } from "./entities/pickup.js";
import { Vector2 } from "./math/vector2.js";
import { circleCircle } from "./systems/collision.js";

export class World {
	#entities = new Map();

	constructor(arena, { bus = null, minAsteroids = 5 } = {}) {
		this.arena = arena;
		this.bus = bus;
		this.minAsteroids = minAsteroids;
	}

	spawn(entity) {
		this.#entities.set(entity.id, entity);
		return entity;
	}

	despawn(idOrEntity) {
		const id = typeof idOrEntity === "number" ? idOrEntity : idOrEntity.id;
		const e = this.#entities.get(id);
		if (e) e.markDead();
	}

	get(id) {
		return this.#entities.get(id);
	}

	*[Symbol.iterator]() {
		for (const e of this.#entities.values()) {
			if (!e.dead) yield e;
		}
	}

	*ofKind(kind) {
		for (const e of this.#entities.values()) {
			if (!e.dead && e.kind === kind) yield e;
		}
	}

	get size() {
		return this.#entities.size;
	}

	step(dt, ctx = {}) {
		const { input, player } = ctx;

		let asteroidCount = 0;
		for (const _ of this.ofKind("asteroid")) asteroidCount++;
		while (asteroidCount < this.minAsteroids) {
			this.spawnEdgeAsteroid(player);
			asteroidCount++;
		}

		for (const e of this.#entities.values()) {
			if (e.dead) continue;

			if (e.kind === "ship" && player && e === player) {
				e.update(dt, this, input ?? {}, this.arena);
			} else if (e.kind === "asteroid") {
				e.update(dt, this);
				e.pos = wrap(e.pos, this.arena);
			} else if (e.kind === "bullet") {
				e.update(dt, this);
				e.pos = wrap(e.pos, this.arena);
			} else {
				e.update(dt, this);
			}
		}

		resolveCollisions(this, player);

		for (const [id, e] of this.#entities) {
			if (e.dead) this.#entities.delete(id);
		}
	}

	spawnEdgeAsteroid(player) {
		const edge = Math.floor(Math.random() * 4);
		let x = 0;
		let y = 0;
		if (edge === 0) {
			x = Math.random() * this.arena.width;
		} else if (edge === 1) {
			x = this.arena.width;
			y = Math.random() * this.arena.height;
		} else if (edge === 2) {
			x = Math.random() * this.arena.width;
			y = this.arena.height;
		} else {
			y = Math.random() * this.arena.height;
		}
		if (player && Math.hypot(x - player.pos.x, y - player.pos.y) < 120) {
			x = (x + this.arena.width / 2) % this.arena.width;
		}
		const radius = 20 + Math.random() * 14;
		this.spawn(new Asteroid(x, y, radius));
	}
}

function wrap(pos, arena) {
	return new Vector2(
		((pos.x % arena.width) + arena.width) % arena.width,
		((pos.y % arena.height) + arena.height) % arena.height,
	);
}

function resolveCollisions(world, player) {
	const ships = [...world.ofKind("ship")];
	const bullets = [...world.ofKind("bullet")];
	const asteroids = [...world.ofKind("asteroid")];
	const pickups = [...world.ofKind("pickup")];

	// куля ↔ астероїд
	for (const b of bullets) {
		for (const a of asteroids) {
			if (b.dead || a.dead) continue;
			if (circleCircle(b.pos, b.radius, a.pos, a.radius)) {
				b.markDead();
				a.markDead();
				spawnExplosion(world, a.pos.x, a.pos.y, 14);
				world.bus?.emit("exploded", {
					x: a.pos.x,
					y: a.pos.y,
					target: "asteroid",
				});
				if (player && b.ownerId === player.id) {
					player.score += 10;
				}
				if (Math.random() < 0.4) {
					const types = ["score", "homing", "heal"];
					const type = types[Math.floor(Math.random() * types.length)];
					world.spawn(new Pickup(a.pos.x, a.pos.y, type));
				}
			}
		}
	}

	// куля ↔ корабель
	for (const b of bullets) {
		for (const s of ships) {
			if (b.dead || s.dead || b.ownerId === s.id) continue;
			if (!s.isAlive) continue;
			if (circleCircle(b.pos, b.radius, s.pos, s.radius)) {
				b.markDead();
				const wasAlive = s.isAlive;
				s.takeDamage(1);
				spawnExplosion(
					world,
					s.pos.x,
					s.pos.y,
					wasAlive && !s.isAlive ? 24 : 8,
				);
				world.bus?.emit(wasAlive && !s.isAlive ? "exploded" : "hit", {
					x: s.pos.x,
					y: s.pos.y,
					target: "ship",
				});
			}
		}
	}

	// корабель ↔ астероїд
	for (const s of ships) {
		if (!s.isAlive) continue;
		for (const a of asteroids) {
			if (a.dead) continue;
			if (circleCircle(s.pos, s.radius, a.pos, a.radius)) {
				a.markDead();
				const wasAlive = s.isAlive;
				s.takeDamage(1);
				spawnExplosion(world, a.pos.x, a.pos.y, 10);
				if (wasAlive && !s.isAlive) {
					spawnExplosion(world, s.pos.x, s.pos.y, 26);
					world.bus?.emit("exploded", {
						x: s.pos.x,
						y: s.pos.y,
						target: "ship",
					});
				} else {
					world.bus?.emit("hit", { x: s.pos.x, y: s.pos.y, target: "ship" });
				}
			}
		}
	}

	// корабель ↔ pickup
	for (const s of ships) {
		if (!s.isAlive) continue;
		for (const p of pickups) {
			if (p.dead) continue;
			if (circleCircle(s.pos, s.radius, p.pos, p.radius)) {
				p.markDead();
				applyPickup(s, p);
				world.bus?.emit("hit", { x: p.pos.x, y: p.pos.y, target: "pickup" });
			}
		}
	}
}

function applyPickup(ship, pickup) {
	switch (pickup.pickupType) {
		case "score":
			ship.score += 50;
			break;
		case "heal":
			ship.heal(1);
			break;
		case "homing":
			ship.homingShots = (ship.homingShots ?? 0) + 5;
			break;
		default:
			ship.score += 25;
	}
}

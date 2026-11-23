import rocketUrl from "./assets/rocket.png";

const ROCKET_HEIGHT = 64;
const ROCKET_ROTATION = 0;

function mulberry32(seed) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function createBackground(arena, dpr) {
	const bg = document.createElement("canvas");
	bg.width = Math.round(arena.width * dpr);
	bg.height = Math.round(arena.height * dpr);
	const g = bg.getContext("2d");
	g.setTransform(dpr, 0, 0, dpr, 0, 0);
	const rand = mulberry32(2026);

	const sky = g.createLinearGradient(0, 0, 0, arena.height);
	sky.addColorStop(0, "#02030a");
	sky.addColorStop(0.5, "#0a0b24");
	sky.addColorStop(1, "#14082b");
	g.fillStyle = sky;
	g.fillRect(0, 0, arena.width, arena.height);

	const nebulae = [
		{ x: 0.2, y: 0.3, r: 280, c: "rgba(90, 60, 200, 0.28)" },
		{ x: 0.8, y: 0.7, r: 320, c: "rgba(200, 50, 140, 0.20)" },
		{ x: 0.55, y: 0.15, r: 220, c: "rgba(40, 140, 220, 0.18)" },
	];
	for (const n of nebulae) {
		const cx = n.x * arena.width;
		const cy = n.y * arena.height;
		const grad = g.createRadialGradient(cx, cy, 0, cx, cy, n.r);
		grad.addColorStop(0, n.c);
		grad.addColorStop(1, "rgba(0, 0, 0, 0)");
		g.fillStyle = grad;
		g.fillRect(0, 0, arena.width, arena.height);
	}

	const tints = ["#ffffff", "#cfe3ff", "#fff1cf"];
	for (let i = 0; i < 260; i++) {
		const x = rand() * arena.width;
		const y = rand() * arena.height;
		const r = rand() * 1.1 + 0.2;
		g.globalAlpha = 0.35 + rand() * 0.65;
		g.fillStyle = tints[Math.floor(rand() * tints.length)];
		g.beginPath();
		g.arc(x, y, r, 0, Math.PI * 2);
		g.fill();
	}

	for (let i = 0; i < 14; i++) {
		const x = rand() * arena.width;
		const y = rand() * arena.height;
		const glow = g.createRadialGradient(x, y, 0, x, y, 9);
		glow.addColorStop(0, "rgba(255, 255, 255, 0.95)");
		glow.addColorStop(0.3, "rgba(180, 210, 255, 0.35)");
		glow.addColorStop(1, "rgba(180, 210, 255, 0)");
		g.globalAlpha = 1;
		g.fillStyle = glow;
		g.fillRect(x - 9, y - 9, 18, 18);
	}
	g.globalAlpha = 1;
	return bg;
}

export function createRenderer(canvas, arena) {
	const ctx = canvas.getContext("2d");
	const dpr = window.devicePixelRatio || 1;

	canvas.style.width = `${arena.width}px`;
	canvas.style.height = `${arena.height}px`;
	canvas.width = Math.round(arena.width * dpr);
	canvas.height = Math.round(arena.height * dpr);
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

	const background = createBackground(arena, dpr);

	const rocket = new Image();
	rocket.src = rocketUrl;

	const lerp = (prev, cur, max, t) =>
		Math.abs(cur - prev) > max / 2 ? cur : prev + (cur - prev) * t;

	function interpPos(entity, alpha) {
		return {
			x: lerp(entity.prevPos.x, entity.pos.x, arena.width, alpha),
			y: lerp(entity.prevPos.y, entity.pos.y, arena.height, alpha),
		};
	}

	function drawShip(ship, alpha, thrusting) {
		if (!ship.isAlive) return;
		const { x, y } = interpPos(ship, alpha);
		const angle = ship.prevAngle + (ship.angle - ship.prevAngle) * alpha;

		ctx.save();
		ctx.translate(x, y);

		// Миготіння під час невразливості після респауну
		if (ship.invulnerable > 0 && Math.floor(ship.invulnerable * 10) % 2 === 0) {
			ctx.globalAlpha = 0.45;
		}

		ctx.rotate(angle);

		const ready = rocket.complete && rocket.naturalWidth > 0;
		const h = ROCKET_HEIGHT;
		const w = ready
			? (rocket.naturalWidth / rocket.naturalHeight) * h
			: h * 0.5;

		if (thrusting) {
			const len = 18 + Math.random() * 14;
			const flame = ctx.createLinearGradient(0, h / 2 - 4, 0, h / 2 + len);
			flame.addColorStop(0, "rgba(255, 240, 160, 0.95)");
			flame.addColorStop(0.5, "rgba(255, 140, 30, 0.85)");
			flame.addColorStop(1, "rgba(255, 60, 0, 0)");
			ctx.fillStyle = flame;
			ctx.beginPath();
			ctx.moveTo(-w * 0.18, h / 2 - 4);
			ctx.lineTo(0, h / 2 + len);
			ctx.lineTo(w * 0.18, h / 2 - 4);
			ctx.closePath();
			ctx.fill();
		}

		if (ready) {
			ctx.rotate(ROCKET_ROTATION);
			ctx.drawImage(rocket, -w / 2, -h / 2, w, h);
		}
		ctx.restore();
	}

	function drawAsteroid(a, alpha) {
		const { x, y } = interpPos(a, alpha);
		const angle = a.prevAngle + (a.angle - a.prevAngle) * alpha;
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(angle);

		ctx.fillStyle = "#3a3f58";
		ctx.strokeStyle = "#8a94b8";
		ctx.lineWidth = 2;
		ctx.beginPath();
		const sides = 9;
		for (let i = 0; i < sides; i++) {
			const theta = (i / sides) * Math.PI * 2;
			const jitter = 0.82 + ((i * 7 + a.id) % 5) * 0.06;
			const r = a.radius * jitter;
			const px = Math.cos(theta) * r;
			const py = Math.sin(theta) * r;
			if (i === 0) ctx.moveTo(px, py);
			else ctx.lineTo(px, py);
		}
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		ctx.restore();
	}

	function drawBullet(b, alpha) {
		const { x, y } = interpPos(b, alpha);
		ctx.save();
		ctx.fillStyle = b.homing ? "#ff5ef7" : "#66f7ff";
		ctx.shadowColor = b.homing ? "#ff5ef7" : "#66f7ff";
		ctx.shadowBlur = 8;
		ctx.beginPath();
		ctx.arc(x, y, b.radius, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}

	function drawPickup(p) {
		const bob = Math.sin(p.bobPhase) * 3;
		const x = p.pos.x;
		const y = p.pos.y + bob;
		const colors = {
			score: "#ffd166",
			heal: "#06d6a0",
			homing: "#ef476f",
		};
		const labels = {
			score: "+50",
			heal: "+HP",
			homing: "HOM",
		};
		const color = colors[p.pickupType] ?? "#ffffff";

		ctx.save();
		ctx.translate(x, y);
		ctx.strokeStyle = color;
		ctx.fillStyle = "rgba(15, 20, 40, 0.85)";
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();

		ctx.fillStyle = color;
		ctx.font = "bold 9px monospace";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(labels[p.pickupType] ?? "?", 0, 0);
		ctx.restore();
	}

	function drawParticle(pt, alpha) {
		const { x, y } = interpPos(pt, alpha);
		const ratio = Math.max(0, pt.life / pt.maxLife);
		ctx.save();
		ctx.globalAlpha = ratio;
		ctx.fillStyle = ratio > 0.5 ? "#ffd166" : "#ff6b35";
		ctx.beginPath();
		ctx.arc(x, y, pt.radius * ratio + 0.5, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}

	return {
		draw(world, player, alpha, thrusting) {
			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.drawImage(background, 0, 0);
			ctx.restore();

			for (const entity of world) {
				switch (entity.kind) {
					case "asteroid":
						drawAsteroid(entity, alpha);
						break;
					case "pickup":
						drawPickup(entity);
						break;
					case "bullet":
						drawBullet(entity, alpha);
						break;
					case "particle":
						drawParticle(entity, alpha);
						break;
					case "ship":
						drawShip(entity, alpha, entity === player && thrusting);
						break;
				}
			}
		},
	};
}

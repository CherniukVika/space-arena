import rocketUrl from "./assets/rocket.png";

const ROCKET_HEIGHT = 64; // висота ракети на екрані, px
// Куди дивиться ніс на вашій картинці:
// вгору = 0, вправо = Math.PI / 2, вниз = Math.PI, вліво = -Math.PI / 2
const ROCKET_ROTATION = 0;

// Детермінований генератор випадкових чисел: зірки завжди в тих самих місцях
function mulberry32(seed) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// Малюємо космос ОДИН раз на прихований canvas, далі в кожному кадрі лише копіюємо
function createBackground(arena, dpr) {
	const bg = document.createElement("canvas");
	bg.width = Math.round(arena.width * dpr);
	bg.height = Math.round(arena.height * dpr);
	const g = bg.getContext("2d");
	g.setTransform(dpr, 0, 0, dpr, 0, 0);
	const rand = mulberry32(2026);

	// 1) глибокий градієнт
	const sky = g.createLinearGradient(0, 0, 0, arena.height);
	sky.addColorStop(0, "#02030a");
	sky.addColorStop(0.5, "#0a0b24");
	sky.addColorStop(1, "#14082b");
	g.fillStyle = sky;
	g.fillRect(0, 0, arena.width, arena.height);

	// 2) туманності: великі розмиті кольорові плями
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

	// 3) дрібні зірки
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

	// 4) кілька яскравих зірок із сяйвом
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

	// CSS-розмір лишається логічним, а буфер збільшуємо в dpr разів
	canvas.style.width = `${arena.width}px`;
	canvas.style.height = `${arena.height}px`;
	canvas.width = Math.round(arena.width * dpr);
	canvas.height = Math.round(arena.height * dpr);
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

	const background = createBackground(arena, dpr);

	const rocket = new Image();
	rocket.src = rocketUrl;

	// не інтерполюємо через «телепорт» на іншу сторону арени
	const lerp = (prev, cur, max, t) =>
		Math.abs(cur - prev) > max / 2 ? cur : prev + (cur - prev) * t;

	return {
		draw(ship, alpha, thrusting) {
			const x = lerp(ship.prevX, ship.x, arena.width, alpha);
			const y = lerp(ship.prevY, ship.y, arena.height, alpha);
			const angle = ship.prevAngle + (ship.angle - ship.prevAngle) * alpha;

			// фон: копіюємо буфер 1:1 у фізичних пікселях, без масштабування
			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.drawImage(background, 0, 0);
			ctx.restore();

			ctx.save();
			ctx.translate(x, y);
			ctx.rotate(angle);

			// розміри ракети зі збереженням пропорцій картинки
			const ready = rocket.complete && rocket.naturalWidth > 0;
			const h = ROCKET_HEIGHT;
			const w = ready
				? (rocket.naturalWidth / rocket.naturalHeight) * h
				: h * 0.5;

			// вогонь двигуна (малюємо ПІД ракетою)
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

			// сама ракета
			if (ready) {
				ctx.rotate(ROCKET_ROTATION);
				ctx.drawImage(rocket, -w / 2, -h / 2, w, h);
			}
			ctx.restore();
		},
	};
}

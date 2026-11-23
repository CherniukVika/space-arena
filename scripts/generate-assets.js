import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

function ensureDir(dir) {
	fs.mkdirSync(dir, { recursive: true });
}

// 1. Генерація валідного 16-bit PCM WAV файлу
function createWavBuffer(durationSec, freqFn, sampleRate = 22050) {
	const numSamples = Math.floor(sampleRate * durationSec);
	const dataSize = numSamples * 2;
	const buf = Buffer.alloc(44 + dataSize);

	buf.write("RIFF", 0);
	buf.writeUInt32LE(36 + dataSize, 4);
	buf.write("WAVE", 8);
	buf.write("fmt ", 12);
	buf.writeUInt32LE(16, 16); // PCM
	buf.writeUInt16LE(1, 20); // Linear PCM
	buf.writeUInt16LE(1, 22); // Mono
	buf.writeUInt32LE(sampleRate, 24);
	buf.writeUInt32LE(sampleRate * 2, 28);
	buf.writeUInt16LE(2, 32);
	buf.writeUInt16LE(16, 34);
	buf.write("data", 36);
	buf.writeUInt32LE(dataSize, 40);

	for (let i = 0; i < numSamples; i++) {
		const t = i / sampleRate;
		const sample = Math.max(-1, Math.min(1, freqFn(t, durationSec)));
		buf.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
	}
	return buf;
}

// 2. Генерація PNG спрайтшиту 192x64 (3 кадри по 64x64: ship, bullet, asteroid)
function createSpriteSheetPng() {
	const width = 192;
	const height = 64;
	const raw = Buffer.alloc((width * 4 + 1) * height);

	const setPixel = (x, y, r, g, b, a = 255) => {
		if (x < 0 || x >= width || y < 0 || y >= height) return;
		const ix = Math.floor(x);
		const iy = Math.floor(y);
		const offset = iy * (width * 4 + 1) + 1 + ix * 4;
		raw[offset] = r;
		raw[offset + 1] = g;
		raw[offset + 2] = b;
		raw[offset + 3] = a;
	};

	// Спрайт 0 (x: 0..63): Космічний корабель (дивиться вгору)
	for (let y = 8; y < 56; y++) {
		const progress = (y - 8) / 48;
		const halfW = Math.floor(progress * 20);
		for (let x = 32 - halfW; x <= 32 + halfW; x++) {
			const isNose = y < 20;
			const isCockpit = y >= 24 && y <= 34 && Math.abs(x - 32) <= 5;
			if (isCockpit) setPixel(x, y, 102, 247, 255);
			else if (isNose) setPixel(x, y, 255, 85, 85);
			else setPixel(x, y, 230, 238, 255);
		}
	}
	// Крила корабля
	for (let y = 40; y < 56; y++) {
		const wing = (y - 40) * 1.1;
		for (let dx = 14; dx < 14 + wing; dx++) {
			setPixel(32 - dx, y, 255, 95, 95);
			setPixel(32 + dx, y, 255, 95, 95);
		}
	}

	// Спрайт 1 (x: 64..127): Енергетична куля
	for (let y = 0; y < 64; y++) {
		for (let x = 64; x < 128; x++) {
			const d = Math.hypot(x - 96, y - 32);
			if (d < 8) setPixel(x, y, 255, 255, 255, 255);
			else if (d < 16) setPixel(x, y, 102, 247, 255, 190);
			else if (d < 24) setPixel(x, y, 50, 150, 255, 70);
		}
	}

	// Спрайт 2 (x: 128..191): Астероїд з кратерами
	for (let y = 0; y < 64; y++) {
		for (let x = 128; x < 192; x++) {
			const dx = x - 160;
			const dy = y - 32;
			const angle = Math.atan2(dy, dx);
			const edge = 24 + Math.sin(angle * 5) * 3 + Math.cos(angle * 3) * 2;
			const d = Math.hypot(dx, dy);
			if (d <= edge) {
				const crater1 = Math.hypot(dx + 7, dy + 6) < 5;
				const crater2 = Math.hypot(dx - 8, dy - 5) < 4;
				const border = d > edge - 2.5;
				if (border) setPixel(x, y, 155, 168, 205);
				else if (crater1 || crater2) setPixel(x, y, 52, 58, 82);
				else setPixel(x, y, 82, 90, 122);
			}
		}
	}

	const crcTable = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		crcTable[n] = c;
	}
	const crc32 = (buf) => {
		let c = 0xffffffff;
		for (let i = 0; i < buf.length; i++)
			c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
		return (c ^ 0xffffffff) >>> 0;
	};
	const chunk = (type, data) => {
		const len = Buffer.alloc(4);
		len.writeUInt32BE(data.length, 0);
		const typeBuf = Buffer.from(type);
		const crc = Buffer.alloc(4);
		crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
		return Buffer.concat([len, typeBuf, data, crc]);
	};

	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // RGBA

	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	return Buffer.concat([
		signature,
		chunk("IHDR", ihdr),
		chunk("IDAT", zlib.deflateSync(raw)),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

ensureDir("public/sprites");
ensureDir("public/audio");
ensureDir("public/api");

fs.writeFileSync("public/sprites/sheet.png", createSpriteSheetPng());

fs.writeFileSync(
	"public/audio/shoot.wav",
	createWavBuffer(0.14, (t, d) => {
		const env = 1 - t / d;
		const freq = 920 - (t / d) * 620;
		return Math.sin(2 * Math.PI * freq * t) * env * 0.45;
	}),
);

fs.writeFileSync(
	"public/audio/hit.wav",
	createWavBuffer(0.18, (t, d) => {
		const env = Math.exp(-t * 18);
		const tone = Math.sin(2 * Math.PI * 190 * t);
		const noise = (Math.random() * 2 - 1) * 0.4;
		return (tone * 0.7 + noise) * env * 0.5;
	}),
);

fs.writeFileSync(
	"public/audio/explode.wav",
	createWavBuffer(0.45, (t, d) => {
		const env = (1 - t / d) ** 1.8;
		const rumble = Math.sin(2 * Math.PI * (75 - t * 40) * t);
		const noise = Math.random() * 2 - 1;
		return (rumble * 0.5 + noise * 0.6) * env * 0.65;
	}),
);

const manifest = {
	images: {
		sheet: "/sprites/sheet.png",
	},
	sprites: {
		ship: { x: 0, y: 0, w: 64, h: 64 },
		bullet: { x: 64, y: 0, w: 64, h: 64 },
		asteroid: { x: 128, y: 0, w: 64, h: 64 },
	},
	audio: {
		fired: "/audio/shoot.wav",
		hit: "/audio/hit.wav",
		exploded: "/audio/explode.wav",
	},
};

fs.writeFileSync("public/manifest.json", JSON.stringify(manifest, null, 2));

const rooms = [
	{
		id: "alpha-sector",
		name: "Alpha Sector (Standard)",
		players: 3,
		maxPlayers: 8,
		arena: { width: 900, height: 620, asteroidCount: 6 },
	},
	{
		id: "nebula-blitz",
		name: "Nebula Blitz (Dense Asteroids)",
		players: 5,
		maxPlayers: 8,
		arena: { width: 960, height: 640, asteroidCount: 10 },
	},
	{
		id: "void-duel",
		name: "Void Duel (Compact Arena)",
		players: 1,
		maxPlayers: 2,
		arena: { width: 760, height: 540, asteroidCount: 4 },
	},
];

fs.writeFileSync("public/api/rooms.json", JSON.stringify(rooms, null, 2));
console.log("Assets generated successfully!");

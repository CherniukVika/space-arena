import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { loadConfig } from "./config.js";
import { streamReplayFile } from "./logger.js";
import { Room } from "./room.js";
import { attachWebSocketServer } from "./wsServer.js";

const config = loadConfig();

const MIME = {
	".html": "text/html; charset=utf-8",
	".js": "application/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".svg": "image/svg+xml",
	".wav": "audio/wav",
	".ico": "image/x-icon",
};

/** @type {Map<string, Room>} */
const rooms = new Map();

function createRoom({ id, name, maxPlayers = 8, arena }) {
	const room = new Room({
		id,
		name,
		maxPlayers,
		arena,
		logsDir: config.logsDir,
		maxBufferedBytes: config.maxBufferedBytes,
	});
	room.on("empty", async (emptyRoom) => {
		// Не видаляємо базові стартові кімнати, а створені користувачем — видаляємо
		if (!emptyRoom.isDefault) {
			rooms.delete(emptyRoom.id);
			await emptyRoom.destroy();
			console.log(`[Server] Empty room "${emptyRoom.id}" removed`);
		}
	});
	rooms.set(room.id, room);
	return room;
}

// Початкові кімнати
const defaultRooms = [
	{
		id: "alpha-sector",
		name: "Alpha Sector (Standard)",
		maxPlayers: 8,
		arena: { width: 900, height: 620, asteroidCount: 6 },
	},
	{
		id: "nebula-blitz",
		name: "Nebula Blitz (Dense Asteroids)",
		maxPlayers: 8,
		arena: { width: 960, height: 640, asteroidCount: 10 },
	},
	{
		id: "void-duel",
		name: "Void Duel (Compact Arena)",
		maxPlayers: 2,
		arena: { width: 760, height: 540, asteroidCount: 4 },
	},
];
for (const def of defaultRooms) {
	const r = createRoom(def);
	r.isDefault = true;
}

function readJsonBody(req, maxBytes = 8192) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let total = 0;
		req.on("data", (chunk) => {
			total += chunk.length;
			if (total > maxBytes) {
				reject(new Error("Payload too large"));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => {
			try {
				const raw = Buffer.concat(chunks).toString("utf8");
				resolve(raw ? JSON.parse(raw) : {});
			} catch {
				reject(new Error("Invalid JSON"));
			}
		});
		req.on("error", reject);
	});
}

const server = http.createServer(async (req, res) => {
	const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
	const pathname = decodeURIComponent(url.pathname);

	// 1. Захист від path traversal ("..")
	if (pathname.includes("..") || url.pathname.includes("..")) {
		res.writeHead(400, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ error: "Path traversal is forbidden" }));
		return;
	}

	// 2. GET /health
	if (req.method === "GET" && pathname === "/health") {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(
			JSON.stringify({
				status: "ok",
				uptimeSec: Math.round(process.uptime()),
				rooms: rooms.size,
				rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
			}),
		);
		return;
	}

	// 3. GET /api/rooms
	if (req.method === "GET" && (pathname === "/api/rooms" || pathname === "/api/rooms.json")) {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify([...rooms.values()].map((r) => r.toJSON())));
		return;
	}

	// 4. POST /api/rooms
	if (req.method === "POST" && pathname === "/api/rooms") {
		try {
			const body = await readJsonBody(req);
			const name = typeof body.name === "string" ? body.name.trim().slice(0, 32) : "";
			if (!name) {
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "Room name is required" }));
				return;
			}
			const id = `room-${Date.now().toString(36)}`;
			const room = createRoom({
				id,
				name,
				maxPlayers: Number(body.maxPlayers) || 6,
				arena: { width: 900, height: 620, asteroidCount: 6 },
			});
			res.writeHead(201, { "Content-Type": "application/json" });
			res.end(JSON.stringify(room.toJSON()));
		} catch (err) {
			res.writeHead(400, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: err.message }));
		}
		return;
	}

	// 5. GET /api/replays/:id — потокова віддача NDJSON-логу без завантаження в пам'ять
	if (req.method === "GET" && pathname.startsWith("/api/replays/")) {
		const roomId = pathname.slice("/api/replays/".length).replace(/[^a-zA-Z0-9_-]/g, "_");
		const filePath = path.join(config.logsDir, `match-${roomId}.ndjson`);
		try {
			await streamReplayFile(filePath, res);
		} catch (err) {
			if (!res.headersSent) {
				res.writeHead(500, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: err.message }));
			}
		}
		return;
	}

	// 6. Статичні файли зібраного клієнта з client/dist
	if (req.method === "GET") {
		const relPath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
		const resolved = path.resolve(config.clientDistDir, relPath);
		if (!resolved.startsWith(config.clientDistDir)) {
			res.writeHead(403, { "Content-Type": "text/plain" });
			res.end("Forbidden");
			return;
		}

		if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
			const ext = path.extname(resolved);
			res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
			fs.createReadStream(resolved).pipe(res);
			return;
		}
	}

	res.writeHead(404, { "Content-Type": "application/json" });
	res.end(JSON.stringify({ error: "Not found" }));
});

const wss = attachWebSocketServer(server, rooms, config);

server.listen(config.port, () => {
	console.log(`[Server] Listening on http://localhost:${config.port}`);
	console.log(`[Server] Logs dir: ${config.logsDir}`);
});

// Graceful shutdown за SIGINT / SIGTERM
let shuttingDown = false;
async function shutdown(signal) {
	if (shuttingDown) return;
	shuttingDown = true;
	console.log(`\n[Server] Received ${signal}. Closing sockets and flushing logs...`);

	for (const ws of wss.clients) {
		ws.close(1001, "Server shutting down");
	}
	wss.close();

	await Promise.all([...rooms.values()].map((r) => r.destroy()));
	server.close(() => {
		console.log("[Server] Shutdown complete.");
		process.exit(0);
	});

	setTimeout(() => process.exit(0), 3000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
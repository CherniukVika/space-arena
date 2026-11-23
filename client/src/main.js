import "./style.css";
import { loadAll } from "./assets/loader.js";
import { AudioSystem } from "./audio/audio.js";
import { ARENA, STEP_HZ } from "./config.js";
import { Ship } from "./entities/ship.js";
import { GameBus } from "./events/bus.js";
import { createInput } from "./input.js";
import { Lobby } from "./lobby/lobby.js";
import { createLoop } from "./loop.js";
import { SocketClient } from "./net/socketClient.js";
import { createRenderer } from "./render.js";
import { createChatView } from "./ui/chatView.js";
import { drawLoadingScreen } from "./ui/loadingScreen.js";
import { createLobbyView } from "./ui/lobbyView.js";
import { World } from "./world.js";

const params = new URLSearchParams(location.search);
const mode = params.get("mode") ?? "fixed";
const manifestUrl = params.get("manifest") ?? "/manifest.json";

const canvas = document.querySelector("#game");
const hud = document.querySelector("#hud");

canvas.style.width = `${ARENA.width}px`;
canvas.style.height = `${ARENA.height}px`;

const controls = document.createElement("div");
controls.style.cssText =
	"position:fixed; bottom:18px; left:50%; transform:translateX(-50%); display:flex; gap:10px; z-index:30;";
const cancelBtn = document.createElement("button");
cancelBtn.textContent = "Cancel Load";
const retryBtn = document.createElement("button");
retryBtn.textContent = "Retry";
retryBtn.style.display = "none";
controls.append(cancelBtn, retryBtn);
document.body.appendChild(controls);

const audioCtx = new AudioContext();
let loadController = null;

async function boot() {
	retryBtn.style.display = "none";
	cancelBtn.style.display = "inline-block";
	loadController = new AbortController();

	cancelBtn.onclick = () => {
		loadController?.abort("Cancelled by user");
	};

	try {
		const assets = await loadAll(manifestUrl, audioCtx, {
			signal: loadController.signal,
			onProgress(state) {
				drawLoadingScreen(canvas, state);
			},
		});

		controls.remove();
		openLobby(assets);
	} catch (err) {
		cancelBtn.style.display = "none";
		retryBtn.style.display = "inline-block";
		drawLoadingScreen(canvas, {
			ratio: 0,
			error: err.message || String(err),
			items: [],
		});
	}
}

retryBtn.onclick = () => boot();

function openLobby(assets) {
	const lobby = new Lobby({ roomsUrl: "/api/rooms", pollIntervalMs: 3000, timeoutMs: 2500 });
	const lobbyView = createLobbyView(document.body, lobby);
	lobbyView.show();
	lobby.start();

	lobby.addEventListener("joined", async (e) => {
		const { playerName, room } = e.detail;
		lobbyView.hide();
		await startGame(assets, playerName, room);
	});
}

async function startGame(assets, playerName, room) {
	const arena = {
		width: room?.arena?.width ?? ARENA.width,
		height: room?.arena?.height ?? ARENA.height,
	};
	const asteroidCount = room?.arena?.asteroidCount ?? 6;

	// Підключаємо WebSocket-обгортку з чергою та автореконектом
	const wsProto = location.protocol === "https:" ? "wss:" : "ws:";
	const socket = new SocketClient(`${wsProto}//${location.host}/ws`);
	createChatView(document.body, socket);
	socket.send({ type: "join", roomId: room.id, name: playerName });
	socket.connect();

	const bus = new GameBus();
	const audio = new AudioSystem(audioCtx, assets.audio, bus);
	await audio.unlock();

	const input = createInput(window);
	const renderer = createRenderer(canvas, arena, assets);
	const world = new World(arena, { bus, minAsteroids: asteroidCount });
	const player = world.spawn(new Ship(arena.width / 2, arena.height / 2, { name: playerName }));

	for (let i = 0; i < asteroidCount; i++) {
		world.spawnEdgeAsteroid(player);
	}

	window.addEventListener("keydown", (e) => {
		if (e.code === "KeyE") player.fire(world);
	});

	const loop = createLoop({
		mode,
		stepHz: STEP_HZ,
		step(dt) {
			world.step(dt, { input: input.read(), player });
		},
		render(alpha) {
			renderer.draw(world, player, alpha, input.read().thrust);
		},
		onStats(s) {
			const status = player.isAlive ? `HP: ${"♥".repeat(player.hp)}` : "RESPAWNING...";
			hud.textContent =
				`ROOM: ${room?.name ?? "Local"} | PILOT: ${player.name}\n` +
				`SCORE: ${player.score} | ${status} | HOMING: ${player.homingShots}\n` +
				`ENTITIES: ${world.size} | FPS: ${s.fps.toFixed(0)} | STEP: ${s.stepsPerSec.toFixed(0)} Hz`;
		},
	});

	loop.start();
}

boot();
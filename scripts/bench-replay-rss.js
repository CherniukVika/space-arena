import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { streamReplayFile } from "../server/src/logger.js";

const tmpDir = path.resolve("server/logs");
fs.mkdirSync(tmpDir, { recursive: true });
const bigLogPath = path.join(tmpDir, "match-bench.ndjson");

// 1. Генеруємо ~35 МБ NDJSON-файлу (250 000 подій)
console.log("Generating ~35 MB NDJSON log...");
const ws = fs.createWriteStream(bigLogPath);
for (let i = 0; i < 250_000; i++) {
	ws.write(
		`${JSON.stringify({
			ts: Date.now() + i,
			type: "chat",
			roomId: "bench",
			from: "Pilot_" + (i % 10),
			text: "Telemetry event payload string for backpressure streaming benchmark #" + i,
		})}\n`,
	);
}
await new Promise((r) => ws.end(r));
const fileSizeMB = (fs.statSync(bigLogPath).size / 1024 / 1024).toFixed(1);
console.log(`Generated file size: ${fileSizeMB} MB`);

// 2. Піднімаємо HTTP-сервер, який віддає файл потоком через pipeline
const server = http.createServer(async (req, res) => {
	if (req.url === "/replay") {
		await streamReplayFile(bigLogPath, res);
	}
});
await new Promise((r) => server.listen(0, r));
const { port } = server.address();

// 3. Качаємо повільним читачем і фіксуємо process.memoryUsage().rss кожні 200 мс
const samples = [];
const timer = setInterval(() => {
	const rssMB = Number((process.memoryUsage().rss / 1024 / 1024).toFixed(2));
	samples.push({ tMs: samples.length * 200, rssMB });
}, 200);

const res = await fetch(`http://127.0.0.1:${port}/replay`);
const reader = res.body.getReader();
let receivedBytes = 0;
while (true) {
	const { done, value } = await reader.read();
	if (done) break;
	receivedBytes += value.byteLength;
	// Імітація повільного каналу клієнта (backpressure)
	await new Promise((r) => setTimeout(r, 2));
}

clearInterval(timer);
server.close();
fs.unlinkSync(bigLogPath);

console.log(`Streamed ${(receivedBytes / 1024 / 1024).toFixed(1)} MB through slow channel.`);
console.table(samples.filter((_, idx) => idx % 2 === 0));
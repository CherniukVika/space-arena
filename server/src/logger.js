import fs from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

/**
 * Transform-потік: перетворює JS-об'єкти подій у рядки NDJSON.
 */
export class NdjsonStringifyTransform extends Transform {
	constructor() {
		super({ writableObjectMode: true });
	}

	_transform(chunk, _encoding, callback) {
		try {
			const line = `${JSON.stringify({ ts: Date.now(), ...chunk })}\n`;
			callback(null, line);
		} catch (err) {
			callback(err);
		}
	}
}

export class MatchLogger {
	#filePath;
	#source;
	#transform;
	#fileStream;
	#pipelinePromise;
	#closed = false;

	constructor(logsDir, roomId) {
		fs.mkdirSync(logsDir, { recursive: true });
		const safeId = roomId.replace(/[^a-zA-Z0-9_-]/g, "_");
		this.#filePath = path.join(logsDir, `match-${safeId}.ndjson`);

		this.#source = new Readable({
			objectMode: true,
			read() {},
		});
		this.#transform = new NdjsonStringifyTransform();
		this.#fileStream = fs.createWriteStream(this.#filePath, { flags: "a" });

		// Обов'язково обробляємо "error" на потоках та pipeline
		this.#pipelinePromise = pipeline(this.#source, this.#transform, this.#fileStream).catch(
			(err) => {
				console.error(`[MatchLogger:${roomId}] pipeline error:`, err.message);
			},
		);
	}

	get filePath() {
		return this.#filePath;
	}

	log(event) {
		if (this.#closed) return;
		this.#source.push(event);
	}

	async close() {
		if (this.#closed) return;
		this.#closed = true;
		this.#source.push(null); // EOF для Readable
		await this.#pipelinePromise;
	}
}

/**
 * Стрімить збережений NDJSON-лог у HTTP-відповідь (res) через pipeline
 * без читання всього файлу в пам'ять (з автоматичним backpressure).
 */
export async function streamReplayFile(filePath, res) {
	if (!fs.existsSync(filePath)) {
		res.writeHead(404, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ error: "Replay log not found" }));
		return;
	}

	const stat = fs.statSync(filePath);
	res.writeHead(200, {
		"Content-Type": "application/x-ndjson; charset=utf-8",
		"Content-Length": stat.size,
	});

	const readStream = fs.createReadStream(filePath, { highWaterMark: 16 * 1024 });
	await pipeline(readStream, res);
}
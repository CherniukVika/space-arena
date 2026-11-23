import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");

export function loadConfig(env = process.env) {
	const rawPort = env.PORT ?? "3000";
	const port = Number(rawPort);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error(`Invalid PORT environment variable: "${rawPort}"`);
	}

	const rawLogsDir = env.LOGS_DIR ?? path.join(rootDir, "server", "logs");
	if (typeof rawLogsDir !== "string" || rawLogsDir.trim() === "") {
		throw new Error("Invalid LOGS_DIR environment variable");
	}

	const clientDistDir = env.CLIENT_DIST_DIR ?? path.join(rootDir, "client", "dist");

	return {
		port,
		logsDir: path.resolve(rawLogsDir),
		clientDistDir: path.resolve(clientDistDir),
		joinTimeoutMs: 5000,
		pingIntervalMs: 15000,
		maxMissedPongs: 2,
		maxMsgPerSec: 20,
		maxPayloadBytes: 4096,
		maxBufferedBytes: 64 * 1024,
	};
}
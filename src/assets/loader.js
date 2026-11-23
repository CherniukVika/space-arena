export class HttpError extends Error {
	constructor(status, url) {
		super(`HTTP ${status} while fetching ${url}`);
		this.name = "HttpError";
		this.status = status;
		this.url = url;
	}
}

function sleep(ms, signal) {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
			return;
		}
		const id = setTimeout(resolve, ms);
		signal?.addEventListener(
			"abort",
			() => {
				clearTimeout(id);
				reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
			},
			{ once: true },
		);
	});
}

/**
 * Повтор з exponential backoff + jitter.
 * Не повторює запит при AbortError або HTTP 4xx.
 */
export async function withRetry(
	fn,
	{ retries = 3, baseDelayMs = 200, signal } = {},
) {
	let attempt = 0;
	while (true) {
		if (signal?.aborted) {
			throw signal.reason ?? new DOMException("Aborted", "AbortError");
		}
		try {
			return await fn();
		} catch (err) {
			if (err?.name === "AbortError") throw err;
			if (err instanceof HttpError && err.status >= 400 && err.status < 500) {
				throw err; // 4xx (наприклад, 404) не ретраїмо
			}
			if (attempt >= retries) throw err;
			const exp = baseDelayMs * 2 ** attempt;
			const jitter = Math.random() * baseDelayMs;
			attempt++;
			await sleep(exp + jitter, signal);
		}
	}
}

export async function fetchJson(url, { signal, timeoutMs } = {}) {
	const signals = [];
	if (signal) signals.push(signal);
	if (timeoutMs) signals.push(AbortSignal.timeout(timeoutMs));
	const combined = signals.length > 1 ? AbortSignal.any(signals) : signals[0];

	const res = await fetch(url, { signal: combined });
	if (!res.ok) {
		throw new HttpError(res.status, url);
	}
	return await res.json();
}

export function loadJson(url, opts = {}) {
	return withRetry(() => fetchJson(url, opts), opts);
}

export function loadImage(url, { signal, retries = 3 } = {}) {
	return withRetry(
		() =>
			new Promise((resolve, reject) => {
				if (signal?.aborted) {
					reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
					return;
				}
				const img = new Image();
				const onAbort = () => {
					img.src = "";
					reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
				};
				signal?.addEventListener("abort", onAbort, { once: true });

				img.onload = () => {
					signal?.removeEventListener("abort", onAbort);
					resolve(img);
				};
				img.onerror = () => {
					signal?.removeEventListener("abort", onAbort);
					reject(new Error(`Failed to load image: ${url}`));
				};
				img.src = url;
			}),
		{ signal, retries },
	);
}

export function loadAudio(url, audioCtx, { signal, retries = 3 } = {}) {
	return withRetry(
		async () => {
			const res = await fetch(url, { signal });
			if (!res.ok) {
				throw new HttpError(res.status, url);
			}
			const arrayBuf = await res.arrayBuffer();
			return await audioCtx.decodeAudioData(arrayBuf);
		},
		{ signal, retries },
	);
}

/**
 * Завантажує маніфест і всі ресурси паралельно через Promise.all
 * із прогресом по кожному файлу.
 */
export async function loadAll(
	manifestUrl,
	audioCtx,
	{ signal, onProgress } = {},
) {
	const manifest = await loadJson(manifestUrl, { signal });

	const entries = [
		...Object.entries(manifest.images ?? {}).map(([key, url]) => ({
			category: "images",
			key,
			url,
			load: () => loadImage(url, { signal }),
		})),
		...Object.entries(manifest.audio ?? {}).map(([key, url]) => ({
			category: "audio",
			key,
			url,
			load: () => loadAudio(url, audioCtx, { signal }),
		})),
	];

	const items = entries.map((e) => ({
		key: `${e.category}/${e.key}`,
		url: e.url,
		status: "pending",
		progress: 0,
	}));

	const notify = () => {
		const done = items.filter((i) => i.status === "done").length;
		onProgress?.({
			total: items.length,
			done,
			ratio: items.length ? done / items.length : 1,
			items: items.map((i) => ({ ...i })),
		});
	};

	notify();

	const results = {
		manifest,
		images: {},
		audio: {},
	};

	await Promise.all(
		entries.map(async (entry, idx) => {
			items[idx].status = "loading";
			items[idx].progress = 0.5;
			notify();

			const data = await entry.load();
			results[entry.category][entry.key] = data;

			items[idx].status = "done";
			items[idx].progress = 1;
			notify();
		}),
	);

	return results;
}

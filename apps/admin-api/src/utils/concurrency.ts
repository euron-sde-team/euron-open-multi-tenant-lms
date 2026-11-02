/**
 * Tiny in-process semaphore. Caps how many async operations run at once.
 *
 * Used by the analytics repository so a single request, even one that
 * schedules a large `Promise.all`, never holds more than `n` PG pool
 * connections simultaneously. Without this, RDS' global `max_connections`
 * gets eaten by bursty analytics dashboards.
 *
 * No external dependency.
 */

export type Limiter = <T>(fn: () => Promise<T>) => Promise<T>;

export const pLimit = (concurrency: number): Limiter => {
	const max = Math.max(1, Math.floor(concurrency));
	let active = 0;
	const queue: Array<() => void> = [];

	const next = () => {
		if (active >= max) return;
		const job = queue.shift();
		if (!job) return;
		active++;
		job();
	};

	return <T>(fn: () => Promise<T>): Promise<T> =>
		new Promise<T>((resolve, reject) => {
			const run = () => {
				fn()
					.then(resolve, reject)
					.finally(() => {
						active--;
						next();
					});
			};
			queue.push(run);
			next();
		});
};

/**
 * Runs tasks in order for the same key while allowing different keys to run
 * concurrently. A failed task never poisons the queue.
 *
 * @template T
 * @param {Map<string, Promise<unknown>>} queueByKey
 * @param {string} key
 * @param {() => Promise<T>} task
 * @returns {Promise<T>}
 */
export async function enqueueSerialTask(queueByKey, key, task) {
  const previous = queueByKey.get(key) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(task);
  queueByKey.set(key, current);
  try {
    return await current;
  } finally {
    if (queueByKey.get(key) === current) {
      queueByKey.delete(key);
    }
  }
}

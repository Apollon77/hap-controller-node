/**
 * Queue used for serializing BLE operations.
 */
export class OpQueue {
    private _current: Promise<unknown>;

    /**
     * Create the queue.
     */
    constructor() {
        this._current = Promise.resolve();
    }

    /**
     * Queue a new operation.
     *
     * @param {function} op - Function to queue
     * @returns {Promise} Promise which resolves when the function has executed.
     */
    queue<T>(op: () => Promise<T>): Promise<T> {
        const ret = new Promise<T>((resolve, reject) => {
            this._current.then(() => {
                op().then(resolve, reject);
            });
        });
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        this._current = ret.catch(() => {
        });
        return ret;
    }
}

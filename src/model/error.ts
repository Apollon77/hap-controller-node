import JSONBig from 'json-bigint';

class HomekitControllerError extends Error {
    public statusCode: number | undefined;

    public body: Record<string, unknown> | undefined;

    constructor(message: string, statusCode?: number, body?: Record<string, unknown> | Buffer) {
        super(message);
        // eslint-disable-next-line no-undefined
        if (statusCode !== undefined) {
            this.setStatusCode(statusCode);
        }
        // eslint-disable-next-line no-undefined
        if (body !== undefined) {
            this.setBody(body);
        }
    }

    setStatusCode(errorCode: number): void {
        this.statusCode = errorCode;
    }

    getStatusCode(): number | undefined {
        return this.statusCode;
    }

    setBody(body: Record<string, unknown> | Buffer): void {
        if (Buffer.isBuffer(body)) {
            try {
                this.body = JSONBig.parse(body.toString('utf-8'));
            } catch (err) {
                this.body = {
                    raw: body,
                };
            }
        } else {
            this.body = body;
        }
    }

    getBody(): Record<string, unknown> | undefined {
        return this.body;
    }
}

export default HomekitControllerError;

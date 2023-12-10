import { IncomingMessage, ServerResponse } from "http";
import { Readable } from "stream";
import { URL } from "url";

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			PGUSER: string;
			PGHOST: string;
			PGPORT: number;
			PGDATABASE: string;
			HTTPS_KEY_PASSPHRASE: string;
		}
	}
	type User = {
		username: string;
		password: string;
	};

	type RequestContext = {
		requestId: string;
		userId?: string;
		isAuthenticated: boolean;
		request: IncomingMessage;
		response: ServerResponse;
		URL: URL;
		isAuthorized: boolean;
		stream?: Readable;
		log?: Logger
	};

	type Token = {
		expiry: Date;
		username: string;
		attributes: { [attribute: string]: string };
	};

	type TokenStore = {
		async create(token: Token): Promise<string>;
		async read(tokenID: string): Promise<Token|undefined>;
	};
	type LOG_LEVEL =
		| "DEBUG"
		| "INFO"
		| "NOTICE"
		| "WARNING"
		| "ERROR"
		| "CRITICAL"
		| "ALERT"
		| "EMERGENCY";

	type Logger = {
		(logText: string,
		logLevel?: LOG_LEVEL): void
	}
}

export {};

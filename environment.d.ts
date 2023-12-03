import { IncomingMessage, ServerResponse } from "http";
import { Readable } from "stream";
import { URL } from "url";

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			DATABASE_USER: string;
			DATABASE_HOST: string;
			DATABASE_PORT: number;
			DATABASE_NAME: string;
			HTTPS_KEY_PASSPHRASE: string;
		}
	}
	type User = {
		username: string;
		password: string;
	};

	type RequestContext= {
		userId: string;
		isAuthenticated: boolean;
		request: IncomingMessage;
		response: ServerResponse;
		URL: URL;
		isAuthorized: boolean;
		stream?: Readable
	};
}

export {};

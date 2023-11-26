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
		userName: string;
		password: string;
	};
}

export {};

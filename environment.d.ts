declare global {
	namespace NodeJS {
		interface ProcessEnv {
			DATABASE_USER: string;
			DATABASE_HOST: string;
			DATABASE_PORT: number;
			DATABASE_NAME: string;
		}
	}
	type User = {
		userName: string;
		password: string;
	};
}

export {};

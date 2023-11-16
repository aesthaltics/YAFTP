declare global {
	namespace NodeJS {
		interface ProcessEnv {
			DATABASE_USER: string;
			DATABASE_HOST: string;
			DATABASE_PORT: number;
			DATABASE_NAME: string;

			DATABASE_TABLES: { [table_name: string]: string };
			DATABASE_FIELDS: {
				[table_name: string]: {
					[columnName: string]: string;
				};
			};
			SCRYPT_N: number;
			SCRYPT_r: number;
			SCRYPT_p: number;
			SCRYPT_dkLen: number;
		}
	}
	type User = {
		userName: string;
		password: string;
	};
}

export {};

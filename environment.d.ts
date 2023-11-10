declare global {
	namespace NodeJS{
		interface ProcessEnv{
			DATABASE_USER: string
		}
	}
}

export {}
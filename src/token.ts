import { randomBytes } from "crypto";
import { query } from "./database.js";
import { DATABASE_TABLES } from "./serverInfo.js";

const simpleTokenStore: TokenStore = {
	async create(token: Token) {
		return new Promise((resolve, reject) => {
			const { table_name, simple_tokens_id, user_name, expiry } =
				DATABASE_TABLES.simple_tokens;
			const insertText = `INSERT INTO ${table_name}(${simple_tokens_id}, ${user_name}, ${expiry}) VALUES($1, $2, $3) RETURNING ${simple_tokens_id}`;
			const insertedValue = [randomBytes(16).toString('base64'), token.username, token.expiry];
			query(insertText, insertedValue, (err, result) => {
				if (err){
					reject(err.message)
				}
				resolve(result.rows[0][simple_tokens_id])
			});
		});
	},
	async read(tokenID: string) {
		return new Promise((resolve, reject) => {
			const {table_name, simple_tokens_id, expiry, user_name} = DATABASE_TABLES.simple_tokens
			query(`SELECT * FROM ${table_name} WHERE ${simple_tokens_id} = $1`, [tokenID], (err, result) => {
				if (err || (result.rowCount ?? 0 < 1)){
					resolve(undefined)
				}
				const token = {
					expiry: result.rows[0][expiry] as Date,
					username: result.rows[0][user_name] as string,
					attributes: {}
				}

				resolve(token)
			})

		})
	},
};

export { simpleTokenStore };

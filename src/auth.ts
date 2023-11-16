import { IncomingMessage, ServerResponse } from "http";
import { requestDataToJSON } from "./server.js";
import pg from "pg";
import { nextTick } from "process";
import { error, table } from "console";
import { scrypt, randomBytes } from "crypto";
const { Client } = pg;
const client = await (async () => {
	const client = new Client({
		host: process.env.DATABASE_HOST,
		port: process.env.DATABASE_PORT,
		database: process.env.DATABASE_NAME,
		user: process.env.DATABASE_USER,
	});
	await client.connect();
	return client;
})();

const databaseInsert = async (
	table: string,
	columns: string[],
	values: any[]
) => {
	if (columns.length !== values.length) {
		Promise.reject(
			new Error("columns and values must have the same length")
		);
	}
	const valuesString = values
		.map((_, index) => {
			return `$${index + 1}`;
		})
		.join(", ");
	const insertText = `INSERT INTO ${table}(${columns.join(
		", "
	)}) VALUES(${valuesString})`;
	try {
		return await client.query(insertText, values);
	} catch (error) {
		Promise.reject(error);
	}
};

const isExactUser = (obj: any): obj is User => {
	// Check for the correct type and existence of each expected property
	const hasValidProps =
		obj &&
		typeof obj === "object" &&
		typeof obj.username === "string" &&
		typeof obj.password === "string";

	// Check if there are no additional properties
	const hasOnlyValidProps = hasValidProps && Object.keys(obj).length === 2;

	return hasValidProps && hasOnlyValidProps;
};

const hashPassword = (
	password: string
) => {
	const normalizedPassword = password.normalize("NFC");
	const salt = randomBytes(16).toString("hex");
	const N = process.env.SCRYPT_N;
	const r = process.env.SCRYPT_r;
	const p = process.env.SCRYPT_p;
	const keyLen = process.env.SCRYPT_dkLen;
	console.log(`N: ${N}`);
	return new Promise<Buffer>((resolve, reject) => {
		scrypt(normalizedPassword, salt, keyLen, {'N': N, 'p':p, 'r':r}, (err: Error|null, hash: Buffer) => {
			if (err){
				return reject(err)
			}
			return resolve(hash)
		});
	});
};

const authenticateUser = () => {};

const storeUser = async (user: User) => {
	const databaseTable = process.env.DATABASE_TABLES["users"];
	const tableColumns = process.env.DATABASE_FIELDS[databaseTable];
	const hashedPassword = hashPassword(user.password);
	return await databaseInsert(
		databaseTable,
		[tableColumns["user_name"], tableColumns["password"]],
		[user.userName, hashedPassword]
	);
};

const registerUser = async (req: IncomingMessage, res: ServerResponse) => {
	const userData = await requestDataToJSON(req);
	if (isExactUser(userData)) {
		storeUser(userData as User);
	} else {
		// TODO: return bad request
	}
};

export { registerUser, isExactUser };

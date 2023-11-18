import { IncomingMessage, ServerResponse } from "http";
import { requestDataToJSON } from "./server.js";
import pg from "pg";
import { nextTick } from "process";
import { error, table } from "console";
import { scrypt, randomBytes } from "crypto";
import {
	DATABASE_TABLES,
	SCRYPT_VARIABLES,
	ONE_GB_IN_BYTES,
} from "./serverInfo.js";

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
		console.log(`Query sent to db: ${insertText}`);
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
		typeof obj.userName === "string" &&
		typeof obj.password === "string";
	if (!hasValidProps) {
		console.log("user does not have valid props");
	}

	// Check if there are no additional properties
	const hasOnlyValidProps = hasValidProps && Object.keys(obj).length === 2;

	if (hasValidProps && !hasOnlyValidProps) {
		console.log("user has too many props");
	}

	if (hasOnlyValidProps) {
		console.log("user has valid format");
	}

	return hasValidProps && hasOnlyValidProps;
};

const hashPassword = (password: string, salt?: string) => {
	// TODO: pepper?
	const normalizedPassword = password.normalize("NFC");
	const effectiveSalt = salt ? Buffer.from(salt, "hex") : randomBytes(16);

	const { N, r, p, dkLen } = SCRYPT_VARIABLES;
	const maxmem = SCRYPT_VARIABLES.maxmem();

	return new Promise<{ hash: string; salt: string }>((resolve, reject) => {
		scrypt(
			normalizedPassword,
			effectiveSalt,
			dkLen,
			{ N: N, p: p, r: r, maxmem: maxmem },
			(err: Error | null, hashBuffer: Buffer) => {
				if (err) {
					console.log(err);
					return reject(err);
				}
				const { stringifiedHash, stringifiedSalt } =
					stringifyHashAndSalt({
						hash: hashBuffer,
						salt: effectiveSalt,
					});
				return resolve({
					hash: stringifiedHash,
					salt: stringifiedSalt,
				});
			}
		);
	});
};

const stringifyHashAndSalt = ({
	hash,
	salt,
}: {
	hash: Buffer;
	salt: Buffer;
}) => {
	const stringifiedHash = hash.toString("hex");
	const stringifiedSalt = salt.toString("hex");
	return { stringifiedHash, stringifiedSalt };
};

const authenticateUser = async (user: User): Promise<boolean> => {
	if (!isExactUser(user)) {
		Promise.reject(new Error("did not get valid user object"));
	}
	const hashAndSaltQuery = {
		// putting user name in values prevent intjection attacks
		text: "SELECT users.password, users.salt FROM users WHERE users.user_name = $1;",
		values: [user.userName],
	};
	const hashAndSaltResponse = await client.query(hashAndSaltQuery);
	if (!hashAndSaltResponse.rowCount || hashAndSaltResponse.rowCount < 1) {
		// username not in database
		return false;
	}
	if (hashAndSaltResponse.rowCount > 1) {
		// TODO: handle multiple users with same name(should never happen as username col has unique requirement)
		return false;
	}

	const storedSalt: string = hashAndSaltResponse.rows[0]["salt"];
	const storedPasswordHash: string = hashAndSaltResponse.rows[0]["password"];

	const { hash: submittedPasswordHash, salt: submittedPasswordSalt } =
		await hashPassword(user.password, storedSalt);

	return (
		storedPasswordHash === submittedPasswordHash &&
		storedSalt === submittedPasswordSalt
	);
};

const storeUser = async (user: User) => {
	// TODO: Don't allow usernames that already exists
	const table = DATABASE_TABLES.users;
	const { hash, salt } = await hashPassword(user.password);
	console.log(hash);
	return await databaseInsert(
		table.table_name,
		[table.user_name, table.password, table.salt, table.max_space],
		[user.userName, hash, salt, ONE_GB_IN_BYTES]
	);
};

const registerUser = async (req: IncomingMessage, res: ServerResponse) => {
	const userData = await requestDataToJSON(req);
	if (isExactUser(userData)) {
		console.log(`user details: ${userData}`);
		try {
			const queryResult = await storeUser(userData as User);
			res.writeHead(200, {
				"Content-Type": "application/json",
				"x-content-type-options": "nosniff",
			});
			return res.end(JSON.stringify({ message: "user created!" }));
		} catch (error) {
			console.log(
				`there was a problem inserting the user to the database: ${JSON.stringify(
					userData
				)}`
			);

			res.writeHead(400, {
				"Content-Type": "application/json",
				"x-content-type-options": "nosniff",
			});
			return res.end(
				JSON.stringify({ message: "could not create user" })
			);
		}
	} else {
		console.log(
			`the userdata is not formatted correctly: ${JSON.stringify(
				userData
			)}`
		);

		res.writeHead(400, {
			"Content-Type": "application/json",
			"x-content-type-options": "nosniff",
		});
		return res.end(JSON.stringify({ message: "could not create user" }));
	}
};

const loginUser = async (req: IncomingMessage, res: ServerResponse) => {
	const SUCCESS_MESSAGE = "success";
	const FAIL_MESSAGE = "fail";
	// TODO: create and respond with session token
	const user = await requestDataToJSON(req);
	if (!isExactUser(user)) {
		res.writeHead(401, {
			"Content-Type": "application/json",
			"x-content-type-options": "nosniff",
		});
		res.end(JSON.stringify({ message: FAIL_MESSAGE }));
		return Promise.reject(new Error("provided data is not a valid user"));
	}
	const authenticated = await authenticateUser(user);

	if (authenticated) {
		res.writeHead(200, {
			"Content-Type": "application/json",
			"x-content-type-options": "nosniff",
		});
		return res.end(JSON.stringify({ message: SUCCESS_MESSAGE }));
	}
	res.writeHead(401, {
		"Content-Type": "application/json",
		"x-content-type-options": "nosniff",
	});
	return res.end(JSON.stringify({ message: FAIL_MESSAGE }));
	// return Promise.reject(new Error("provided data is not a valid user"));
};

export { registerUser, isExactUser, loginUser };

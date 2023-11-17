import { IncomingMessage, ServerResponse } from "http";
import { requestDataToJSON } from "./server.js";
import pg from "pg";
import { nextTick } from "process";
import { error, table } from "console";
import { scrypt, randomBytes } from "crypto";
import { DATABASE_TABLES, SCRYPT_VARIABLES, ONE_GB_IN_BYTES } from "./serverInfo.js";


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

const hashPassword = (password: string) => {
	// TODO: pepper?
	const normalizedPassword = password.normalize("NFC");
	const salt = randomBytes(16)

	const { N, r, p, dkLen} = SCRYPT_VARIABLES;
	const maxmem = SCRYPT_VARIABLES.maxmem()

	return new Promise<{ hash: Buffer; salt: Buffer }>((resolve, reject) => {
		scrypt(
			normalizedPassword,
			salt,
			dkLen,
			{ N: N, p: p, r: r, maxmem: maxmem },
			(err: Error | null, hash: Buffer) => {
				if (err) {
					console.log(err)
					return reject(err);
				}
				console.log(hash)
				return resolve({ hash: hash, salt: salt });
			}
		);
	});
};

const authenticateUser = () => {};

const storeUser = async (user: User) => {
	// TODO: Don't allow usernames that already exists
	const table = DATABASE_TABLES.users
	const { hash, salt } = await hashPassword(user.password);
	console.log(hash.toString("hex"));
	return await databaseInsert(
		table.table_name,
		[
			table.user_name,
			table.password,
			table.salt,
			table.max_space
		],
		[user.userName, hash.toString('hex'), salt.toString('hex'), ONE_GB_IN_BYTES]
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

export { registerUser, isExactUser };

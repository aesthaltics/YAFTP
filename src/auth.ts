import { IncomingMessage, ServerResponse } from "http";
import { requestDataToJSON } from "./server.js";
import { query } from "./database.js";
import { scrypt, randomBytes } from "crypto";
import {
	DATABASE_TABLES,
	SCRYPT_VARIABLES,
	ONE_GB_IN_BYTES,
} from "./serverInfo.js";
import { Readable } from "stream";
import { LOG_LEVEL } from "./serverInfo.js";

const durationInMs = ({
	hours = 0,
	minutes = 0,
	seconds = 0,
}: {
	hours?: number;
	minutes?: number;
	seconds?: number;
}) => {
	minutes = hours * 60 + minutes;
	seconds = minutes * 60 + seconds;
	return seconds * 1000;
};

const userFromAuthorizationHeader = (
	header?: string,
	log?: Logger
): User | undefined => {
	// TODO: is this func using the correct log levels?
	if (header === undefined) {
		if (log) {
			log("authorization header not provided", "NOTICE");
		}
		return;
	}
	const [scheme, params] = header.split(" ");
	if (scheme !== "Basic") {
		if (log) {
			log("not using correct auth scheme", "NOTICE");
		}
	}
	const [username, password] = atob(params).split(":");
	return {
		username: username,
		password: password,
	};
};

const isExactUser = (obj: any): obj is User => {
	// Check for the correct type and existence of each expected property
	const hasValidProps =
		obj &&
		typeof obj === "object" &&
		typeof obj.username === "string" &&
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
	return new Promise((resolve, reject) => {
		if (!isExactUser(user)) {
			// TODO: convert this to log
			return false;
			reject(new Error("did not get valid user object"));
		}
		query(
			"SELECT users.password, users.salt FROM users WHERE users.user_name = $1",
			[user.username],
			async (err, result) => {
				if (err || !result.rowCount || result.rowCount < 1) {
					// username not in database
					return resolve(false);
				}
				if (result.rowCount > 1) {
					// TODO: handle multiple users with same name(should never happen as username col has unique requirement)
					return resolve(false);
				}
				const storedSalt: string = result.rows[0]["salt"];
				const storedPasswordHash: string = result.rows[0]["password"];

				const {
					hash: submittedPasswordHash,
					salt: submittedPasswordSalt,
				} = await hashPassword(user.password, storedSalt);

				resolve(
					storedPasswordHash === submittedPasswordHash &&
						storedSalt === submittedPasswordSalt
				);
			}
		);
	});
};

const storeUser = async (user: User) => {
	// TODO: Don't allow usernames that already exists
	const {
		table_name,
		user_name,
		password,
		salt: saltCol,
		max_space,
	} = DATABASE_TABLES.users;
	const { hash, salt } = await hashPassword(user.password);
	console.log(hash);
	query(
		`INSERT INTO ${table_name}(${user_name}, ${password}, ${saltCol}, ${max_space}) VALUES($1, $2, $3, $4)`,
		[user.username, hash, salt, ONE_GB_IN_BYTES],
		(err, result) => {
			return;
		}
	);
};

const registerUser = async (req: IncomingMessage) => {
	// const userData = await requestDataToJSON(req);
	const userData = userFromAuthorizationHeader(req.headers.authorization);
	if (isExactUser(userData)) {
		// TODO: handle this log
		// console.log(`user details: ${userData}`);
		try {
			const queryResult = await storeUser(userData as User);
			return;
		} catch (error) {
			// TODO: handle this log
			// console.log(
			// 	`there was a problem inserting the user to the database: ${JSON.stringify(
			// 		userData
			// 	)}`
			// );
			return Promise.reject("could not register user");
		}
	} else {
		// TODO: handle this log
		// console.log(
		// 	`the userdata is not formatted correctly: ${JSON.stringify(
		// 		userData
		// 	)}`
		// );

		return Promise.reject("could not register user");
	}
};

const loginUserBasicToken = async (
	context: RequestContext,
	store: TokenStore,
	log?: Logger
): Promise<string | undefined> => {
	// TODO: is this func using the correct log levels?

	const SUCCESS_MESSAGE = "success";
	const FAIL_MESSAGE = "fail";

	if (!context.isAuthenticated) {
		if (log) {
			log(
				"Speaker: loginUserBasicToken\n Message: User is not authenticated! How did this function even get called?",
				"WARNING"
			);
		}
		return;
	}

	if (!context.userId || context.userId.length < 1) {
		if (log) {
			log(
				"Speaker: loginUserBasicToken\n Message: No or emtpy userId! How did this function even get called?",
				"WARNING"
			);
		}
		return;
	}

	const tokenID = store.create({
		expiry: new Date(Date.now() + durationInMs({ minutes: 10 })),
		username: context.userId,
		attributes: {},
	});

	return tokenID;
};

const handleLogin = async (context: RequestContext, store: TokenStore) => {
	const SUCCESS_MESSAGE = "success";
	const FAIL_MESSAGE = "fail";

	context.response.setHeader("Content-Type", "application/json");
	context.response.setHeader("x-content-type-options", "nosniff");

	const acceptLogin = (tokenID: string) => {
		context.response.statusCode = 200;
		context.response.statusMessage = "OK";

		// TODO: set session cookie to tokenid instead of sending it in json

		context.stream = Readable.from(
			JSON.stringify({ message: SUCCESS_MESSAGE, token: tokenID })
		);
		return;
	};

	const denyLogin = () => {
		context.response.statusCode = 401;
		context.response.statusMessage = "Unauthorized";

		context.stream = Readable.from(
			JSON.stringify({ message: FAIL_MESSAGE, token: undefined })
		);
		return;
	};

	const tokenID = await loginUserBasicToken(context, store);

	if (!tokenID || tokenID.length < 1) {
		return denyLogin();
	}
	if (tokenID) {
		return acceptLogin(tokenID);
	}
};

export {
	registerUser,
	isExactUser,
	handleLogin,
	authenticateUser,
	userFromAuthorizationHeader,
};

import { IncomingMessage, ServerResponse } from "http";
import { Server, createServer } from "https";

import fs from "fs";
import fsAsync from "fs/promises";
import { URL, fileURLToPath } from "url";
import path, { extname, resolve } from "path";
import {
	authenticateUser,
	handleLogin,
	registerUser,
	userFromAuthorizationHeader,
} from "./auth.js";
import { Readable } from "stream";
import { DATABASE_TABLES, LOG_LEVEL, tokenStore } from "./serverInfo.js";
import { randomUUID } from "crypto";
import { query } from "./database.js";



type fileData = {
	name: string;
	lastModified: number;
	size: number;
	type: string;
};

const filesColumns = {
	filePath: "FilePath",
	fileName: "FileName",
	fileType: "FileType",
	fileSize: "FileSize",
};

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const STORAGE_DIRECTORY = path.join(__dirname, "storage");

// Routes

// GET
const ROUTE_PATH = path.join(__dirname, "routes");
const SCRIPTS_PATH = path.join(ROUTE_PATH, "js");

// POST
const UPLOAD_METADATA_ROUTE = "/file-metadata";
const UPLOAD_FILE_ROUTE = "/file-upload";
const USER_REGISTRATION_ROUTE = "/register-user";
const LOGIN_USER_ROUTE = "/login-user";

const PORT = 42069;



export const requestDataToJSON = async (req: IncomingMessage) => {
	let stringifiedJSON = "";
	return new Promise<object>((resolve, reject) => {
		req.on("data", (chunk) => {
			const stringifiedChunk = Buffer.from(chunk).toString("utf-8");
			stringifiedJSON = stringifiedJSON.concat(stringifiedChunk);
		});
		req.on("end", async () => {
			let dataAsJSON = JSON.parse(stringifiedJSON);
			resolve(dataAsJSON);
		});
		req.on("error", (error) => {
			reject(error);
		});
	});
};

const createLogger = async (requestId: string, username?: string) => {
	let userId = 1;
	if (username) {
		const userIdQueryResponse = await client.query({
			text: `SELECT ${DATABASE_TABLES.users.user_id} FROM ${DATABASE_TABLES.users.table_name} WHERE ${DATABASE_TABLES.users.user_name} = $1;`,
			values: [username],
		});
		userId =
			userIdQueryResponse.rows[0][`${DATABASE_TABLES.users.user_id}`];
	}

	const logMessage: Logger = async (
		logText: string,
		logLevel: LOG_LEVEL = 'INFO'
	): Promise<void> => {
		const { user_id, log_text, request_id, log_level } =
			DATABASE_TABLES.log;
		const insertText = `INSERT INTO log(${user_id}, ${log_text}, ${request_id}, ${log_level}) VALUES($1, $2, $3, $4) RETURNING *`;
		const insertedValue = [userId, logText, requestId, logLevel];
		await client.query(insertText, insertedValue);
	};

	return logMessage;
};

const insertFileToDatabase = async (
	name: string,
	path: string,
	type: string,
	size: number
) => {
	// TODO: update this function
	// TODO: make sure the user has enough space
	const { table_name, file_name, file_type, file_size, file_path } =
		DATABASE_TABLES.files;
	const insertText = `INSERT INTO ${table_name}(${file_path}, ${file_name}, ${file_type}, ${file_size}) VALUES($1, $2, $3, $4) RETURNING *`;
	const insertedValue = [path, name, type, size];
	const res = await client.query(insertText, insertedValue);
};

const handleMetaData = async (req: IncomingMessage, res: ServerResponse) => {
	// TODO: update this function

	const currentTime = Date.now().toString();
	const directoryPath = path.join(STORAGE_DIRECTORY, currentTime);
	await fsAsync.mkdir(directoryPath, {
		recursive: true,
	});
	const filesArray = await requestDataToJSON(req);
	// TODO: handle this log
	// console.log(filesArray);

	if (filesArray instanceof Array) {
		let promsises = filesArray.map((fileData: fileData) => {
			return [
				insertFileToDatabase(
					fileData.name,
					path.join(directoryPath, fileData.name),
					fileData.type,
					fileData.size
				),
				fsAsync.writeFile(
					path.join(STORAGE_DIRECTORY, currentTime, fileData.name),
					""
				),
			];
		});
		promsises.push([
			fsAsync.writeFile(
				path.join(STORAGE_DIRECTORY, currentTime, "manifest.json"),
				JSON.stringify(filesArray)
			),
		]);

		try {
			await Promise.all(promsises.flat(1));
			return currentTime;
		} catch (error) {
			return Promise.reject("Could not store metadata");
		}
	} else {
		res.writeHead(400, "Bad Request");
		return Promise.reject("Data is not stringified array");
	}
};

const handleUpload = async (context: RequestContext) => {
	const searchParams = context.URL.searchParams;
	const uploadID = searchParams.get("id");
	const fileName = searchParams.get("file");
	if (uploadID === null || fileName === null) {
		return Promise.reject("request did not contain id or file params");
	}
	const filePath = path.join(STORAGE_DIRECTORY, uploadID, fileName);
	return new Promise<void>((resolve, reject) => {
		try {
			const file = fs.createWriteStream(filePath, { encoding: "binary" });
			context.request.pipe(file);
			file.on("finish", () => {
				// TODO: handle this log
				// console.log(`${fileName} has been saved!`);
				resolve();
			});
			file.on("error", (error) => {
				// TODO: handle this log
				// console.log("Could not save file");
				// console.log(error.message);
				reject(`Could not save: ${fileName}`);
			});
		} catch (error) {
			// TODO: handle this log
			// console.log(`Could not save: ${fileName}`);
			reject(`Could not save: ${fileName}`);
		}
	});
};

const createFileStream = (
	filePath: fs.PathLike,
	callback: (err?: any, data?: fs.ReadStream) => void
) => {
	fs.access(filePath, fs.constants.R_OK, (err) => {
		if (err) {
			return callback(err);
		}
		const stream = fs.createReadStream(filePath, { encoding: "utf8" });
		callback(undefined, stream);
	});
};

const serve404 = (): fs.ReadStream => {
	return fs.createReadStream(path.join(ROUTE_PATH, "404", "index.html"));
};

const serveHTML = (filePath: string) => {
	return new Promise<Readable | undefined>((resolve, reject) => {
		createFileStream(
			path.join(ROUTE_PATH, filePath, "index.html"),
			(err, data) => {
				if (err) {
					return reject(new Error("page not found"));
					// res.writeHead(404, "Page not found");
					// serve404().pipe(res);
					// return;
				}
				// res.writeHead(200, "Ok", { "Content-Type": "text/html" });
				// data?.pipe(res);
				return resolve(data);
			}
		);
	});
};

const serveJS = (filePath: string) => {
	return new Promise<Readable | undefined>((resolve, reject) => {
		createFileStream(path.join(SCRIPTS_PATH, filePath), (err, stream) => {
			if (err) {
				return reject(new Error("script not found"));
				// res.writeHead(404, "Page not found");
				// res.end();
				// return;
			}
			// res.writeHead(200, "Ok", { "Content-Type": "text/javascript" });
			return resolve(stream);
			// stream?.pipe(res);
			// return;
		});
	});
};

const authenticate = async (context: RequestContext) => {
	const denyAuthentication = () => {
		context.isAuthenticated = false;
		return false;
	};
	const acceptAuthentication = (userId: string) => {
		context.isAuthenticated = true;
		context.userId = userId;
		return true;
	};

	const user = userFromAuthorizationHeader(
		context.request.headers.authorization,
		context.log
	);
	if (!user) {
		return denyAuthentication();
	}
	const authenticated = await authenticateUser(user);
	if (!authenticated) {
		return denyAuthentication();
	}
	if (authenticated) {
		return acceptAuthentication(user.username);
	}
	return denyAuthentication();
};

const logRequest = async (context: RequestContext): Promise<void> => {
	if (context.log === undefined) {
		Promise.reject(new Error("context do not have logger"));
		return;
	}

	let logMessages = [];

	logMessages.push(`Authenticated: ${context.isAuthenticated}`);
	logMessages.push(`Username: ${context.userId}`);
	logMessages.push(`Method: ${context.request.method}`);
	logMessages.push(`Path: ${context.URL.pathname}`);

	if (context.URL.search.length > 0) {
		logMessages.push(`Search: ${context.URL.search}\n`);
		for (const [name, value] of context.URL.searchParams) {
			logMessages.push(`Search Param: ${name} = ${value}`);
		}
	}

	let promises = logMessages.map((message) => {
		if (context.log) {
			context.log(message);
		}
	});
	await Promise.all(promises);
};

const authorizeGet = (context: RequestContext) => {
	//TODO: implement authorization of getting files etc.
	//no routes require authentication yet

	// TODO: create whitelist for public routes

	context.isAuthorized = true;
	return;
};

const authorizePost = (context: RequestContext) => {
	//TODO: implement authorization for sending files etc.
	//no routes require authentication yet

	// TODO: create whitelist for public routes
	context.isAuthorized = true;
	return;
};

const authorize = (context: RequestContext) => {
	const method = context.request.method;

	if (method === undefined) {
		return;
	}

	// if (!context.isAuthenticated){
	// 	return false
	// }

	switch (method.toString().toLowerCase()) {
		case "get":
			return authorizeGet(context);
		case "post":
			return authorizePost(context);
		default:
			return;
	}
};

const setResponseHeaders = (context: RequestContext) => {
	// TODO: set secure headers
	if (!context.isAuthorized) {
		if (!context.isAuthenticated) {
			// Client provided wrong or no credentials
			// TODO: redirect to login route
			context.response.setHeader("WWW-Authenticate", 'Basic realm="/"');
			context.response.writeHead(401, "Unauthorized");
		} else {
			// Client not authorized to do this action
			context.response.writeHead(403, "Forbidden");
		}
	}
};

const respond = (context: RequestContext) => {
	if (context.stream !== undefined) {
		context.stream.pipe(context.response);
	} else {
		context.response.end();
	}
	return;
};

const handleRequest = async (context: RequestContext) => {
	const method = context.request.method;
	if (method === undefined) {
		return;
	}
	switch (method.toString().toLowerCase()) {
		case "get":
			await handleGet(context);
			break;
		case "post":
			await handlePost(context);
			break;
		default:
			break;
	}
};

const handleGet = async (context: RequestContext) => {
	const path = context.URL.pathname;
	let stream: Readable | undefined;
	try {
		if (extname(path) === ".js") {
			stream = await serveJS(path);
			context.response.setHeader("Content-Type", "text/javascript");
		} else {
			stream = await serveHTML(path);
			context.response.setHeader("Content-Type", "text/html");
		}
	} catch (error) {
		stream = serve404();
		context.response.writeHead(404, "Not Found");
		if (context.log) {
			context.log(`Could not find route for: ${path}`);
		}
	}

	context.stream = stream;
};

const handlePost = async (context: RequestContext): Promise<void> => {
	const path = context.URL.pathname;

	switch (path) {
		case UPLOAD_METADATA_ROUTE:
			try {
				const uploadID = await handleMetaData(
					context.request,
					context.response
				);
				context.stream = Readable.from(
					JSON.stringify({ uploadID: uploadID })
				);
				context.response.writeHead(200, "OK");
			} catch (error) {
				context.response.writeHead(400, "Bad Request");
				return Promise.reject(error);
			}
			break;
		case UPLOAD_FILE_ROUTE:
			try {
				await handleUpload(context);
				context.response.writeHead(200, "OK");
			} catch (error) {
				context.response.writeHead(500, "Internal Server Error");
				return Promise.reject(error);
			}
			break;
		case USER_REGISTRATION_ROUTE:
			context.response.setHeader("Content-Type", "application/json");
			context.response.setHeader("x-content-type-options", "nosniff");
			try {
				await registerUser(context.request);
				context.response.writeHead(200, "OK");
				context.stream = Readable.from(
					JSON.stringify({ message: "User created" })
				);
			} catch (error) {
				context.response.writeHead(500, "Internal Server Error");
				context.stream = Readable.from(
					JSON.stringify({ message: "Could not create user" })
				);
				return Promise.reject(error);
			}
			break;
		case LOGIN_USER_ROUTE:
			try {
				await handleLogin(context, tokenStore)
			} catch (error) {
				return Promise.reject(error);
			}
			break;
		default:
			break;
	}
};

const httpsOptions = {
	key: fs.readFileSync(path.join(__dirname, "keys", "key.pem")),
	cert: fs.readFileSync(path.join(__dirname, "keys", "cert.pem")),
	passphrase: process.env.HTTPS_KEY_PASSPHRASE,
};

const server = createServer(httpsOptions, async (req, res) => {
	// TODO: log total time from recieved request to complete response
	// TODO: context.userID should change name to username or be converted to actual userid and remain consistent
	const requestId = randomUUID;
	const context: RequestContext = {
		requestId: randomUUID(),
		isAuthenticated: false,
		request: req,
		response: res,
		URL: new URL(req.url ?? "/404.html", `http://${req.headers.host}`),
		isAuthorized: false,
	};

	if (context.URL.pathname === "/") {
		context.URL.pathname = "/home";
	}
	await authenticate(context);

	context.log = await createLogger(context.requestId, context.userId);
	await logRequest(context);
	authorize(context);

	if (!context.isAuthorized) {
		setResponseHeaders(context);
		return respond(context);
	}

	await handleRequest(context);

	setResponseHeaders(context);
	return respond(context);
});

server.listen(PORT);

server.on("listening", async () => {
	console.log("\n\n --------------------------------------- \n\n");
	console.log(`Server listening on https://localhost:${PORT}`);
	console.log("\n\n --------------------------------------- \n\n");
});

import { IncomingMessage, ServerResponse } from "http";
import { Server, createServer } from "https";

import fs from "fs";
import fsAsync from "fs/promises";
import { URL, fileURLToPath } from "url";
import path, { extname, resolve } from "path";
import pg from "pg";
import { authenticateUser, loginUser, registerUser } from "./auth.js";
import { Readable } from "stream";

const { Client } = pg;

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

const insertFileToDatabase = async (
	fileName: string,
	filePath: string,
	fileType: string,
	fileSize: number
) => {
	const insertText = `INSERT INTO files(\"FilePath\", \"${filesColumns.fileName}\", \"${filesColumns.fileType}\", \"${filesColumns.fileSize}\") VALUES($1, $2, $3, $4) RETURNING *`;
	const insertedValue = [filePath, fileName, fileType, fileSize];
	const res = await client.query(insertText, insertedValue);
	console.log(res.rows[0]);
};

const handleMetaData = async (req: IncomingMessage, res: ServerResponse) => {
	const currentTime = Date.now().toString();
	const directoryPath = path.join(STORAGE_DIRECTORY, currentTime);
	await fsAsync.mkdir(directoryPath, {
		recursive: true,
	});
	const filesArray = await requestDataToJSON(req);
	console.log(filesArray);

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
	// TODO: update client to send authentication header
	let userID = "";
	const denyAuthentication = () => {
		context.isAuthenticated = false;
		context.userId = userID;
		return false;
	};
	const acceptAuthentication = () => {
		context.isAuthenticated = true;
		context.userId = userID;
		return true;
	};
	if (context.request.headers.authorization === undefined) {
		return denyAuthentication();
	}
	const [scheme, params] = context.request.headers.authorization.split(" ");
	if (scheme !== "Basic") {
		return denyAuthentication();
	}
	const [userName, password] = atob(params).split(":");

	userID = userName;

	try {
		const authenticated = await authenticateUser({
			username: userName,
			password: password,
		});
		if (!authenticated) {
			return denyAuthentication();
		}
		return acceptAuthentication();
	} catch (error) {
		//TODO: handle error
		return denyAuthentication();
	}
};

const logRequest = (context: RequestContext) => {
	//TODO: implement proper logging
	let logString = "";
	const delimiter = "\n------------------\n";

	logString += delimiter;
	logString += `Authenticated: ${context.isAuthenticated}\n`;
	logString += `Username: ${context.userId}\n`;
	logString += `Method: ${context.request.method}\n`;
	logString += `Path: ${context.URL.pathname}\n`;

	if (context.URL.search.length > 0) {
		logString += `Search: ${context.URL.search}\n`;
		for (const [name, value] of context.URL.searchParams) {
			logString += `Search Param: ${name} = ${value}\n`;
		}
	}

	logString += delimiter;

	context.response.on("close", () => {
		console.log(logString);
	});
	return;
};

const authorizeGet = (context: RequestContext) => {
	//TODO: implement authorization of getting files etc.
	//no routes require authentication yet
	context.isAuthorized = true;
	return;
};

const authorizePost = (context: RequestContext) => {
	//TODO: implement authorization for sending files etc.
	//no routes require authentication yet
	context.isAuthorized = true;
	return;
};

const authorize = (context: RequestContext) => {
	const method = context.request.method;

	if (method === undefined) {
		return;
	}

	switch (method) {
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
			// TODO: set WWW-Autheticate header?
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
	switch (method) {
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
	if (extname(path) === ".js") {
		stream = await serveJS(path);
	} else {
		stream = await serveHTML(path);
	}
	if (stream === undefined) {
		stream = serve404();
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
				registerUser(context.request);
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
				loginUser(context);
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
	// TODO: convert long if-else chains to switch
	const context: RequestContext = {
		userId: "",
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
	logRequest(context);
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
	console.log(`Server listening on https://localhost:${PORT}`);
});

import {
	ClientRequest,
	IncomingMessage,
	Server,
	ServerResponse,
	createServer,
} from "http";
import fs from "fs";
import fsAsync from "fs/promises";
import { URL, fileURLToPath } from "url";
import path, { extname, resolve } from "path";
import pg from "pg";
import { registerUser } from "./auth.js";

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
const LOG_DELIMITER = () => console.log("------------------");

const STORAGE_DIRECTORY = path.join(__dirname, "storage");

// Routes

// GET
const ROUTE_PATH = path.join(__dirname, "routes");
const SCRIPTS_PATH = path.join(ROUTE_PATH, "js");

// POST
const UPLOAD_METADATA_ROUTE = "/file-metadata";
const UPLOAD_FILE_ROUTE = "/file-upload";
const USER_REGISTRATION_ROUTE = "/register-user";

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
		await Promise.all(promsises.flat(1));
		res.writeHead(200, "Ok");
		res.end(`${currentTime}`);
		return;
	} else {
		res.writeHead(400, "Bad Request");
		res.end("Data is not stringified array");
	}
	res.writeHead(200, "Ok");
	res.end("Ok");
};

const handleUpload = async (
	req: IncomingMessage,
	res: ServerResponse,
	url: URL
) => {
	const uploadID = url.searchParams.get("id");
	const fileName = url.searchParams.get("file");
	if (uploadID === null || fileName === null) {
		console.log("request did not contain id or file params");
		// TODO: respond with bad query code
		return res.end();
	}
	const filePath = path.join(STORAGE_DIRECTORY, uploadID, fileName);
	try {
		await fsAsync.access(filePath);
		const file = fs.createWriteStream(filePath, { encoding: "binary" });
		req.pipe(file);
		file.on("finish", () => {
			// TODO: better response
			console.log(`${fileName} has been saved!`);
			res.end("File was saved!");
		});
		file.on("error", (error) => {
			console.log("Could not save file");
			console.log(error.message);
			// TODO: better response
			res.end("Could not save file");
		});
	} catch (error) {
		// TODO: respond with bad query code
		console.log(`Could not save file ${fileName}`);
		return res.end();
	}
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

const serveHTML = (res: ServerResponse, filePath: string) => {
	createFileStream(
		path.join(ROUTE_PATH, filePath, "index.html"),
		(err, data) => {
			if (err) {
				res.writeHead(404, "Page not found");
				serve404().pipe(res);
				return;
			}
			res.writeHead(200, "Ok", { "Content-Type": "text/html" });
			data?.pipe(res);
		}
	);
};

const serveJS = (res: ServerResponse, filePath: string) => {
	createFileStream(path.join(SCRIPTS_PATH, filePath), (err, stream) => {
		if (err) {
			res.writeHead(404, "Page not found");
			res.end();
			return;
		}
		res.writeHead(200, "Ok", { "Content-Type": "text/javascript" });
		stream?.pipe(res);
		return;
	});
};
const server = createServer(async (req, res) => {
	const url = new URL(req.url ?? "/404.html", `http://${req.headers.host}`);
	if (url.pathname === "/") {
		url.pathname = "/home";
	}

	LOG_DELIMITER();
	console.log(`Path: ${url.pathname}`);
	if (url.search.length > 0) {
		console.log(`Search: ${url.search}`);
		for (const [name, value] of url.searchParams) {
			console.log(`Search Param: ${name} = ${value}`);
		}
	}

	// log delimiter on close, in case there is logging by other functions related to the same request
	// this breaks when multiple requests happen simultaniously
	// TODO: fix this
	res.on("close", () => {
		LOG_DELIMITER();
		console.log("\n\n\n");
	});

	if (req.method === "GET") {
		if (extname(url.pathname) === ".js") {
			return serveJS(res, url.pathname);
		}
		return serveHTML(res, url.pathname);
	}
	if (req.method === "POST") {
		// const buffer = Buffer.from()
		if (url.pathname === UPLOAD_METADATA_ROUTE) {
			return handleMetaData(req, res);
		}
		if (url.pathname === UPLOAD_FILE_ROUTE) {
			console.log(req.headers);
			return handleUpload(req, res, url);
		}
		if (url.pathname === USER_REGISTRATION_ROUTE) {
			return registerUser(req, res);
		}
	}
});

server.listen(PORT);

server.on("listening", async () => {
	console.log(`Server listening on http://localhost:${PORT}`);
});

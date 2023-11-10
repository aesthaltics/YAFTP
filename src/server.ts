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
import path, { extname } from "path";
import pg from "pg";

const { Client } = pg;

type fileData = {
	name: string;
	lastModified: number;
	size: number;
	type: string;
};

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const LOG_DELIMITER = () => console.log("------------------");

const STORAGE_DIRECTORY = path.join(__dirname, "storage");

// Routes

// GET
const ROUTE_PATH = path.join(__dirname, "routes");
const SCRIPTS_PATH = path.join(ROUTE_PATH, "js");

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

const insertFileToDatabase = async (fileName: string) => {
	const insertText = "INSERT INTO files(\"file-name\") VALUES($1) RETURNING *"
	const insertedValue = [fileName]
	const res = await client.query(insertText, insertedValue)
	console.log(res.rows[0])
};

const handleMetaData = async (req: IncomingMessage, res: ServerResponse) => {
	const currentTime = Date.now().toString();
	await fsAsync.mkdir(path.join(STORAGE_DIRECTORY, currentTime), {
		recursive: true,
	});
	let stringifiedFiles = "";
	req.on("data", (chunk) => {
		const stringifiedChunk = Buffer.from(chunk).toString("utf-8");
		stringifiedFiles = stringifiedFiles.concat(stringifiedChunk);
	});
	req.on("end", async () => {
		let filesArray = JSON.parse(stringifiedFiles);
		console.log(filesArray);

		if (filesArray instanceof Array) {
			let promsises = filesArray.map((fileData: fileData) => {
				return fsAsync.writeFile(
					path.join(STORAGE_DIRECTORY, currentTime, fileData.name),
					""
				);
			});
			promsises.push(
				fsAsync.writeFile(
					path.join(STORAGE_DIRECTORY, currentTime, "manifest.json"),
					stringifiedFiles
				)
			);
			await Promise.all(promsises);
			res.writeHead(200, "Ok");
			res.end(`${currentTime}`);
			return;
		} else {
			res.writeHead(400, "Bad Request");
			res.end("Data is not stringified array");
		}
		res.writeHead(200, "Ok");
		res.end("Ok");
	});
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
		if (url.pathname === "/file-metadata") {
			return handleMetaData(req, res);
		}
		if (url.pathname === "/file-upload") {
			console.log(req.headers);
			return handleUpload(req, res, url);
		}
	}
});

server.listen(PORT);

server.on("listening", async () => {
	console.log(`Server listening on http://localhost:${PORT}`);
	await insertFileToDatabase('test.txt')
});

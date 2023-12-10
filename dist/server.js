var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { createServer } from "https";
import fs from "fs";
import fsAsync from "fs/promises";
import { URL, fileURLToPath } from "url";
import path, { extname } from "path";
import pg from "pg";
import { authenticateUser, loginUser, registerUser, userFromAuthorizationHeader, } from "./auth.js";
import { Readable } from "stream";
import { DATABASE_TABLES } from "./serverInfo.js";
import { randomUUID } from "crypto";
const { Client } = pg;
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
const client = await (() => __awaiter(void 0, void 0, void 0, function* () {
    const client = new Client({
        host: process.env.DATABASE_HOST,
        port: process.env.DATABASE_PORT,
        database: process.env.DATABASE_NAME,
        user: process.env.DATABASE_USER,
    });
    yield client.connect();
    return client;
}))();
export const requestDataToJSON = (req) => __awaiter(void 0, void 0, void 0, function* () {
    let stringifiedJSON = "";
    return new Promise((resolve, reject) => {
        req.on("data", (chunk) => {
            const stringifiedChunk = Buffer.from(chunk).toString("utf-8");
            stringifiedJSON = stringifiedJSON.concat(stringifiedChunk);
        });
        req.on("end", () => __awaiter(void 0, void 0, void 0, function* () {
            let dataAsJSON = JSON.parse(stringifiedJSON);
            resolve(dataAsJSON);
        }));
        req.on("error", (error) => {
            reject(error);
        });
    });
});
const createLogger = (requestId, username) => __awaiter(void 0, void 0, void 0, function* () {
    let userId = 1;
    if (username) {
        const userIdQueryResponse = yield client.query({
            text: `SELECT ${DATABASE_TABLES.users.user_id} FROM ${DATABASE_TABLES.users.table_name} WHERE ${DATABASE_TABLES.users.user_name} = $1;`,
            values: [username],
        });
        userId =
            userIdQueryResponse.rows[0][`${DATABASE_TABLES.users.user_id}`];
    }
    const logMessage = (logText, logLevel = 'INFO') => __awaiter(void 0, void 0, void 0, function* () {
        const { user_id, log_text, request_id, log_level } = DATABASE_TABLES.log;
        const insertText = `INSERT INTO log(${user_id}, ${log_text}, ${request_id}, ${log_level}) VALUES($1, $2, $3, $4) RETURNING *`;
        const insertedValue = [userId, logText, requestId, logLevel];
        yield client.query(insertText, insertedValue);
    });
    return logMessage;
});
const insertFileToDatabase = (name, path, type, size) => __awaiter(void 0, void 0, void 0, function* () {
    // TODO: make sure the user has enough space
    const { table_name, file_name, file_type, file_size, file_path } = DATABASE_TABLES.files;
    const insertText = `INSERT INTO ${table_name}(${file_path}, ${file_name}, ${file_type}, ${file_size}) VALUES($1, $2, $3, $4) RETURNING *`;
    const insertedValue = [path, name, type, size];
    const res = yield client.query(insertText, insertedValue);
});
const handleMetaData = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const currentTime = Date.now().toString();
    const directoryPath = path.join(STORAGE_DIRECTORY, currentTime);
    yield fsAsync.mkdir(directoryPath, {
        recursive: true,
    });
    const filesArray = yield requestDataToJSON(req);
    // TODO: handle this log
    // console.log(filesArray);
    if (filesArray instanceof Array) {
        let promsises = filesArray.map((fileData) => {
            return [
                insertFileToDatabase(fileData.name, path.join(directoryPath, fileData.name), fileData.type, fileData.size),
                fsAsync.writeFile(path.join(STORAGE_DIRECTORY, currentTime, fileData.name), ""),
            ];
        });
        promsises.push([
            fsAsync.writeFile(path.join(STORAGE_DIRECTORY, currentTime, "manifest.json"), JSON.stringify(filesArray)),
        ]);
        try {
            yield Promise.all(promsises.flat(1));
            return currentTime;
        }
        catch (error) {
            return Promise.reject("Could not store metadata");
        }
    }
    else {
        res.writeHead(400, "Bad Request");
        return Promise.reject("Data is not stringified array");
    }
});
const handleUpload = (context) => __awaiter(void 0, void 0, void 0, function* () {
    const searchParams = context.URL.searchParams;
    const uploadID = searchParams.get("id");
    const fileName = searchParams.get("file");
    if (uploadID === null || fileName === null) {
        return Promise.reject("request did not contain id or file params");
    }
    const filePath = path.join(STORAGE_DIRECTORY, uploadID, fileName);
    return new Promise((resolve, reject) => {
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
        }
        catch (error) {
            // TODO: handle this log
            // console.log(`Could not save: ${fileName}`);
            reject(`Could not save: ${fileName}`);
        }
    });
});
const createFileStream = (filePath, callback) => {
    fs.access(filePath, fs.constants.R_OK, (err) => {
        if (err) {
            return callback(err);
        }
        const stream = fs.createReadStream(filePath, { encoding: "utf8" });
        callback(undefined, stream);
    });
};
const serve404 = () => {
    return fs.createReadStream(path.join(ROUTE_PATH, "404", "index.html"));
};
const serveHTML = (filePath) => {
    return new Promise((resolve, reject) => {
        createFileStream(path.join(ROUTE_PATH, filePath, "index.html"), (err, data) => {
            if (err) {
                return reject(new Error("page not found"));
                // res.writeHead(404, "Page not found");
                // serve404().pipe(res);
                // return;
            }
            // res.writeHead(200, "Ok", { "Content-Type": "text/html" });
            // data?.pipe(res);
            return resolve(data);
        });
    });
};
const serveJS = (filePath) => {
    return new Promise((resolve, reject) => {
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
const authenticate = (context) => __awaiter(void 0, void 0, void 0, function* () {
    const denyAuthentication = () => {
        context.isAuthenticated = false;
        return false;
    };
    const acceptAuthentication = (userId) => {
        context.isAuthenticated = true;
        context.userId = userId;
        return true;
    };
    try {
        const user = userFromAuthorizationHeader(context.request.headers.authorization);
        const authenticated = yield authenticateUser(user);
        if (!authenticated) {
            return denyAuthentication();
        }
        return acceptAuthentication(user.username);
    }
    catch (error) {
        //TODO: handle error
        return denyAuthentication();
    }
});
const logRequest = (context) => __awaiter(void 0, void 0, void 0, function* () {
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
    yield Promise.all(promises);
});
const authorizeGet = (context) => {
    //TODO: implement authorization of getting files etc.
    //no routes require authentication yet
    context.isAuthorized = true;
    return;
};
const authorizePost = (context) => {
    //TODO: implement authorization for sending files etc.
    //no routes require authentication yet
    context.isAuthorized = true;
    return;
};
const authorize = (context) => {
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
const setResponseHeaders = (context) => {
    // TODO: set secure headers
    if (!context.isAuthorized) {
        if (!context.isAuthenticated) {
            // Client provided wrong or no credentials
            // TODO: set WWW-Autheticate header?
            context.response.setHeader("WWW-Authenticate", 'Basic realm="/"');
            context.response.writeHead(401, "Unauthorized");
        }
        else {
            // Client not authorized to do this action
            context.response.writeHead(403, "Forbidden");
        }
    }
};
const respond = (context) => {
    if (context.stream !== undefined) {
        context.stream.pipe(context.response);
    }
    else {
        context.response.end();
    }
    return;
};
const handleRequest = (context) => __awaiter(void 0, void 0, void 0, function* () {
    const method = context.request.method;
    if (method === undefined) {
        return;
    }
    switch (method.toString().toLowerCase()) {
        case "get":
            yield handleGet(context);
            break;
        case "post":
            yield handlePost(context);
            break;
        default:
            break;
    }
});
const handleGet = (context) => __awaiter(void 0, void 0, void 0, function* () {
    const path = context.URL.pathname;
    let stream;
    try {
        if (extname(path) === ".js") {
            stream = yield serveJS(path);
            context.response.setHeader("Content-Type", "text/javascript");
        }
        else {
            stream = yield serveHTML(path);
            context.response.setHeader("Content-Type", "text/html");
        }
    }
    catch (error) {
        stream = serve404();
        context.response.writeHead(404, "Not Found");
        if (context.log) {
            context.log(`Could not find route for: ${path}`);
        }
    }
    context.stream = stream;
});
const handlePost = (context) => __awaiter(void 0, void 0, void 0, function* () {
    const path = context.URL.pathname;
    switch (path) {
        case UPLOAD_METADATA_ROUTE:
            try {
                const uploadID = yield handleMetaData(context.request, context.response);
                context.stream = Readable.from(JSON.stringify({ uploadID: uploadID }));
                context.response.writeHead(200, "OK");
            }
            catch (error) {
                context.response.writeHead(400, "Bad Request");
                return Promise.reject(error);
            }
            break;
        case UPLOAD_FILE_ROUTE:
            try {
                yield handleUpload(context);
                context.response.writeHead(200, "OK");
            }
            catch (error) {
                context.response.writeHead(500, "Internal Server Error");
                return Promise.reject(error);
            }
            break;
        case USER_REGISTRATION_ROUTE:
            context.response.setHeader("Content-Type", "application/json");
            context.response.setHeader("x-content-type-options", "nosniff");
            try {
                yield registerUser(context.request);
                context.response.writeHead(200, "OK");
                context.stream = Readable.from(JSON.stringify({ message: "User created" }));
            }
            catch (error) {
                context.response.writeHead(500, "Internal Server Error");
                context.stream = Readable.from(JSON.stringify({ message: "Could not create user" }));
                return Promise.reject(error);
            }
            break;
        case LOGIN_USER_ROUTE:
            try {
                yield loginUser(context);
            }
            catch (error) {
                return Promise.reject(error);
            }
            break;
        default:
            break;
    }
});
const httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, "keys", "key.pem")),
    cert: fs.readFileSync(path.join(__dirname, "keys", "cert.pem")),
    passphrase: process.env.HTTPS_KEY_PASSPHRASE,
};
const server = createServer(httpsOptions, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // TODO: log total time from recieved request to complete response
    const context = {
        requestId: randomUUID(),
        isAuthenticated: false,
        request: req,
        response: res,
        URL: new URL((_a = req.url) !== null && _a !== void 0 ? _a : "/404.html", `http://${req.headers.host}`),
        isAuthorized: false,
    };
    if (context.URL.pathname === "/") {
        context.URL.pathname = "/home";
    }
    yield authenticate(context);
    context.log = yield createLogger(context.requestId, context.userId);
    yield logRequest(context);
    authorize(context);
    if (!context.isAuthorized) {
        setResponseHeaders(context);
        return respond(context);
    }
    yield handleRequest(context);
    setResponseHeaders(context);
    return respond(context);
}));
server.listen(PORT);
server.on("listening", () => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`Server listening on https://localhost:${PORT}`);
}));

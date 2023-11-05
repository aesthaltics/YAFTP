var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { createServer, } from "http";
import fs from "fs";
import fsAsync from "fs/promises";
import { URL, fileURLToPath } from "url";
import path, { extname } from "path";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const STORAGE_DIRECTORY = path.join(__dirname, "storage");
// Routes
// GET
const ROUTE_PATH = path.join(__dirname, "routes");
const SCRIPTS_PATH = path.join(ROUTE_PATH, "js");
const PORT = 42069;
const handleMetaData = (req, res) => {
    const currentTime = Date.now().toString();
    fs.mkdirSync(path.join(STORAGE_DIRECTORY, currentTime), {
        recursive: true,
    });
    let stringifiedFiles = "";
    req.on("data", (chunk) => {
        const buffer = Buffer.from(chunk).toString("utf-8");
        stringifiedFiles += buffer;
    });
    req.on("end", () => __awaiter(void 0, void 0, void 0, function* () {
        let filesArray = JSON.parse(stringifiedFiles);
        console.log(filesArray);
        if (filesArray instanceof Array) {
            let promsises = filesArray.map((fileData) => {
                return fsAsync.writeFile(path.join(STORAGE_DIRECTORY, currentTime, fileData.name), "");
            });
            promsises.push(fsAsync.writeFile(path.join(STORAGE_DIRECTORY, currentTime, 'manifest.json'), stringifiedFiles));
            yield Promise.all(promsises);
            res.writeHead(200, 'Ok');
            res.end(`${currentTime}`);
            return;
        }
        else {
            res.writeHead(400, "Bad Request");
            res.end("Data is not stringified array");
        }
        res.writeHead(200, "Ok");
        res.end("Ok");
    }));
};
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
const serveHTML = (res, filePath) => {
    createFileStream(path.join(ROUTE_PATH, filePath, "index.html"), (err, data) => {
        if (err) {
            res.writeHead(404, "Page not found");
            serve404().pipe(res);
            return;
        }
        res.writeHead(200, "Ok", { "Content-Type": "text/html" });
        data === null || data === void 0 ? void 0 : data.pipe(res);
    });
};
const serveJS = (res, filePath) => {
    createFileStream(path.join(SCRIPTS_PATH, filePath), (err, stream) => {
        if (err) {
            res.writeHead(404, "Page not found");
            res.end();
            return;
        }
        res.writeHead(200, "Ok", { "Content-Type": "text/javascript" });
        stream === null || stream === void 0 ? void 0 : stream.pipe(res);
        return;
    });
};
const server = createServer((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const url = new URL((_a = req.url) !== null && _a !== void 0 ? _a : "/404.html", `http://${req.headers.host}`);
    if (url.pathname === "/") {
        url.pathname = "/home";
    }
    console.log(url);
    if (req.method === "GET") {
        if (extname(url.pathname) === ".js") {
            return serveJS(res, url.pathname);
        }
        return serveHTML(res, url.pathname);
    }
    if (req.method === "POST") {
        // const buffer = Buffer.from()
        if (url.pathname === "/file-metadata") {
            return yield handleMetaData(req, res);
        }
        console.log(req);
    }
}));
server.listen(PORT);
server.on("listening", () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});

import { createServer } from "http";
import fs from "fs";
import { URL, fileURLToPath } from "url";
import path, { extname } from "path";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROUTE_PATH = path.join(__dirname, "routes");
const SCRIPTS_PATH = path.join(ROUTE_PATH, "js");
const PORT = 420;
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
const server = createServer((req, res) => {
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
        console.log(req);
        req.on("data", (chunk) => {
            console.log(JSON.parse(Buffer.from(chunk).toString('utf8')));
        });
        req.on("end", () => {
            res.end("Ok");
        });
    }
});
server.listen(PORT);
server.on("listening", () => {
    console.log(`Server listening on port ${PORT}`);
});

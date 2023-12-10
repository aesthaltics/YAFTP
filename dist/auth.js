var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import pg from "pg";
import { scrypt, randomBytes } from "crypto";
import { DATABASE_TABLES, SCRYPT_VARIABLES, ONE_GB_IN_BYTES, } from "./serverInfo.js";
import { Readable } from "stream";
const { Client } = pg;
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
const userFromAuthorizationHeader = (header) => {
    if (header === undefined) {
        throw new Error("authorization header not provided");
    }
    const [scheme, params] = header.split(" ");
    if (scheme !== "Basic") {
        throw new Error("not using correct scheme");
    }
    const [userName, password] = atob(params).split(":");
    return {
        username: userName,
        password: password,
    };
};
const databaseInsert = (table, columns, values) => __awaiter(void 0, void 0, void 0, function* () {
    if (columns.length !== values.length) {
        Promise.reject(new Error("columns and values must have the same length"));
    }
    const valuesString = values
        .map((_, index) => {
        return `$${index + 1}`;
    })
        .join(", ");
    const insertText = `INSERT INTO ${table}(${columns.join(", ")}) VALUES(${valuesString})`;
    try {
        console.log(`Query sent to db: ${insertText}`);
        return yield client.query(insertText, values);
    }
    catch (error) {
        Promise.reject(error);
    }
});
const isExactUser = (obj) => {
    // Check for the correct type and existence of each expected property
    const hasValidProps = obj &&
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
const hashPassword = (password, salt) => {
    // TODO: pepper?
    const normalizedPassword = password.normalize("NFC");
    const effectiveSalt = salt ? Buffer.from(salt, "hex") : randomBytes(16);
    const { N, r, p, dkLen } = SCRYPT_VARIABLES;
    const maxmem = SCRYPT_VARIABLES.maxmem();
    return new Promise((resolve, reject) => {
        scrypt(normalizedPassword, effectiveSalt, dkLen, { N: N, p: p, r: r, maxmem: maxmem }, (err, hashBuffer) => {
            if (err) {
                console.log(err);
                return reject(err);
            }
            const { stringifiedHash, stringifiedSalt } = stringifyHashAndSalt({
                hash: hashBuffer,
                salt: effectiveSalt,
            });
            return resolve({
                hash: stringifiedHash,
                salt: stringifiedSalt,
            });
        });
    });
};
const stringifyHashAndSalt = ({ hash, salt, }) => {
    const stringifiedHash = hash.toString("hex");
    const stringifiedSalt = salt.toString("hex");
    return { stringifiedHash, stringifiedSalt };
};
const authenticateUser = (user) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(user);
    if (!isExactUser(user)) {
        Promise.reject(new Error("did not get valid user object"));
    }
    const hashAndSaltQuery = {
        // putting user name in values prevent intjection attacks
        text: "SELECT users.password, users.salt FROM users WHERE users.user_name = $1;",
        values: [user.username],
    };
    const hashAndSaltResponse = yield client.query(hashAndSaltQuery);
    if (!hashAndSaltResponse.rowCount || hashAndSaltResponse.rowCount < 1) {
        // username not in database
        return false;
    }
    if (hashAndSaltResponse.rowCount > 1) {
        // TODO: handle multiple users with same name(should never happen as username col has unique requirement)
        return false;
    }
    const storedSalt = hashAndSaltResponse.rows[0]["salt"];
    const storedPasswordHash = hashAndSaltResponse.rows[0]["password"];
    const { hash: submittedPasswordHash, salt: submittedPasswordSalt } = yield hashPassword(user.password, storedSalt);
    return (storedPasswordHash === submittedPasswordHash &&
        storedSalt === submittedPasswordSalt);
});
const storeUser = (user) => __awaiter(void 0, void 0, void 0, function* () {
    // TODO: Don't allow usernames that already exists
    const table = DATABASE_TABLES.users;
    const { hash, salt } = yield hashPassword(user.password);
    console.log(hash);
    return yield databaseInsert(table.table_name, [table.user_name, table.password, table.salt, table.max_space], [user.username, hash, salt, ONE_GB_IN_BYTES]);
});
const registerUser = (req) => __awaiter(void 0, void 0, void 0, function* () {
    // const userData = await requestDataToJSON(req);
    const userData = userFromAuthorizationHeader(req.headers.authorization);
    if (isExactUser(userData)) {
        // TODO: handle this log
        // console.log(`user details: ${userData}`);
        try {
            const queryResult = yield storeUser(userData);
            return;
        }
        catch (error) {
            // TODO: handle this log
            // console.log(
            // 	`there was a problem inserting the user to the database: ${JSON.stringify(
            // 		userData
            // 	)}`
            // );
            return Promise.reject("could not register user");
        }
    }
    else {
        // TODO: handle this log
        // console.log(
        // 	`the userdata is not formatted correctly: ${JSON.stringify(
        // 		userData
        // 	)}`
        // );
        return Promise.reject("could not register user");
    }
});
const loginUser = (context) => __awaiter(void 0, void 0, void 0, function* () {
    const SUCCESS_MESSAGE = "success";
    const FAIL_MESSAGE = "fail";
    // TODO: create and respond with session token
    // const user = await requestDataToJSON(context.request);
    const user = userFromAuthorizationHeader(context.request.headers.authorization);
    if (!isExactUser(user)) {
        context.response.writeHead(401, {
            "Content-Type": "application/json",
            "x-content-type-options": "nosniff",
        });
        context.stream = Readable.from(JSON.stringify({ message: FAIL_MESSAGE }));
        return Promise.reject(new Error("provided data is not a valid user object"));
    }
    const authenticated = yield authenticateUser(user);
    if (authenticated) {
        context.response.writeHead(200, {
            "Content-Type": "application/json",
            "x-content-type-options": "nosniff",
        });
        context.stream = Readable.from(JSON.stringify({ message: SUCCESS_MESSAGE }));
        return;
    }
    context.response.writeHead(401, {
        "Content-Type": "application/json",
        "x-content-type-options": "nosniff",
    });
    context.stream = Readable.from(JSON.stringify({ message: FAIL_MESSAGE }));
    return Promise.reject(new Error("Unsuccessful login attempt"));
});
export { registerUser, isExactUser, loginUser, authenticateUser, userFromAuthorizationHeader, };

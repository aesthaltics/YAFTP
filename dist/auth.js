var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { requestDataToJSON } from "./server.js";
import pg from "pg";
import { scrypt, randomBytes } from "crypto";
import { DATABASE_TABLES, SCRYPT_VARIABLES, ONE_GB_IN_BYTES } from "./serverInfo.js";
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
const hashPassword = (password) => {
    // TODO: pepper?
    const normalizedPassword = password.normalize("NFC");
    const salt = randomBytes(16);
    const { N, r, p, dkLen } = SCRYPT_VARIABLES;
    const maxmem = SCRYPT_VARIABLES.maxmem();
    return new Promise((resolve, reject) => {
        scrypt(normalizedPassword, salt, dkLen, { N: N, p: p, r: r, maxmem: maxmem }, (err, hash) => {
            if (err) {
                console.log(err);
                return reject(err);
            }
            console.log(hash);
            return resolve({ hash: hash, salt: salt });
        });
    });
};
const authenticateUser = () => { };
const storeUser = (user) => __awaiter(void 0, void 0, void 0, function* () {
    // TODO: 
    const table = DATABASE_TABLES.users;
    const { hash, salt } = yield hashPassword(user.password);
    console.log(hash.toString("hex"));
    return yield databaseInsert(table.table_name, [
        table.user_name,
        table.password,
        table.salt,
        table.max_space
    ], [user.userName, hash.toString('hex'), salt.toString('hex'), ONE_GB_IN_BYTES]);
});
const registerUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userData = yield requestDataToJSON(req);
    if (isExactUser(userData)) {
        console.log(`user details: ${userData}`);
        try {
            const queryResult = yield storeUser(userData);
            res.writeHead(200, {
                "Content-Type": "application/json",
                "x-content-type-options": "nosniff",
            });
            return res.end(JSON.stringify({ message: "user created!" }));
        }
        catch (error) {
            console.log(`there was a problem inserting the user to the database: ${JSON.stringify(userData)}`);
            res.writeHead(400, {
                "Content-Type": "application/json",
                "x-content-type-options": "nosniff",
            });
            return res.end(JSON.stringify({ message: "could not create user" }));
        }
    }
    else {
        console.log(`the userdata is not formatted correctly: ${JSON.stringify(userData)}`);
        res.writeHead(400, {
            "Content-Type": "application/json",
            "x-content-type-options": "nosniff",
        });
        return res.end(JSON.stringify({ message: "could not create user" }));
    }
});
export { registerUser, isExactUser };

const DATABASE_TABLES = {
    // TODO: this feels kinda weird(maybe change to individual types?)
    users: {
        table_name: "users",
        user_id: "user_id",
        user_name: "user_name",
        password: "password",
        max_space: "max_space",
        salt: "salt",
    },
    log: {
        table_name: "log",
        log_id: "log_id",
        user_id: "user_id",
        log_text: "log_text",
        timestamp: "timestamp",
        request_id: "request_id",
        log_level: "log_level",
    },
    files: {
        table_name: 'files',
        file_id: 'file_id',
        file_path: 'file_path',
        file_name: 'file_name',
        file_type: 'file_type',
        file_size: 'file_size',
        last_change: 'last_change',
        transfer: 'transfer'
    }
};
const SCRYPT_VARIABLES = {
    N: Math.pow(2, 17),
    r: 8,
    p: 1,
    dkLen: 64,
    maxmem() {
        return 128 * this.N * this.r * 2;
    },
};
const ONE_GB_IN_BYTES = Math.pow(10, 9);
export { DATABASE_TABLES, SCRYPT_VARIABLES, ONE_GB_IN_BYTES };

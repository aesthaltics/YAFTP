const DATABASE_TABLES = {
    users: {
        table_name: "users",
        user_id: "user_id",
        user_name: "user_name",
        password: "password",
        max_space: "max_space",
        salt: "salt",
    },
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
const ONE_GB_IN_BYTES = Math.pow(10, 6);
export { DATABASE_TABLES, SCRYPT_VARIABLES, ONE_GB_IN_BYTES };

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const REGISTER_USER_ROUTE = "/register-user";
const requestRegistration = (user) => __awaiter(void 0, void 0, void 0, function* () {
    if (user.userName.length < 1 || user.password.length < 1) {
        Promise.reject(new Error("not given username or password"));
    }
    const stringifiedUser = JSON.stringify(user);
    console.log(stringifiedUser);
    const response = yield fetch(REGISTER_USER_ROUTE, {
        method: "POST",
        body: stringifiedUser,
        headers: {
            'Content-Type': 'text/javascript'
        }
    });
    console.log(yield response.json());
});
window.addEventListener("load", (event) => {
    const registerButton = document.getElementById("register-button");
    registerButton === null || registerButton === void 0 ? void 0 : registerButton.addEventListener("click", (event) => {
        event.preventDefault();
        const userNameElement = document.getElementById("user-name");
        const passwordElement = document.getElementById("password");
        if (userNameElement instanceof HTMLInputElement &&
            passwordElement instanceof HTMLInputElement) {
            const userDetails = {
                userName: userNameElement.value,
                password: passwordElement.value,
            };
            console.log(userDetails);
            requestRegistration(userDetails);
        }
    });
});
export {};

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const LOGIN_USER_ROUTE = "/login-user";
const requestLogin = (user) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (user.userName.length < 1 || user.password.length < 1) {
        Promise.reject(new Error("not given username or password"));
    }
    const stringifiedUser = JSON.stringify(user);
    console.log(stringifiedUser);
    const response = yield fetch(LOGIN_USER_ROUTE, {
        method: "POST",
        body: stringifiedUser,
        headers: {
            "Content-Type": "text/javascript",
        },
    });
    const loginResponse = yield response.json();
    const loginMessage = loginResponse.message;
    const loginMessageParagraphId = "loginMessageParagraph";
    const loginForm = document.getElementById("login-form");
    const loginMessageParagraph = (_a = document.getElementById(loginMessageParagraphId)) !== null && _a !== void 0 ? _a : document.createElement("p");
    if (!loginMessageParagraph.id) {
        loginMessageParagraph.id = loginMessageParagraphId;
        loginForm === null || loginForm === void 0 ? void 0 : loginForm.appendChild(loginMessageParagraph);
    }
    if (loginMessage === "success") {
        loginMessageParagraph.innerText = "Success!";
        loginMessageParagraph.style["color"] = "green";
    }
    else {
        loginMessageParagraph.innerText = "Fail";
        loginMessageParagraph.style["color"] = "red";
    }
});
window.addEventListener("load", (event) => {
    const loginButton = document.getElementById("login-button");
    loginButton === null || loginButton === void 0 ? void 0 : loginButton.addEventListener("click", (event) => {
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
            requestLogin(userDetails);
        }
    });
});
export {};

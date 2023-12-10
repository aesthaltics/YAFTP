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
    if (user.username.length < 1 || user.password.length < 1) {
        Promise.reject(new Error("not given username or password"));
    }
    // const stringifiedUser = JSON.stringify(user);
    // console.log(stringifiedUser);
    const response = yield fetch(LOGIN_USER_ROUTE, {
        method: "POST",
        // body: stringifiedUser,
        headers: {
            "Content-Type": "text/javascript",
            Authorization: `Basic ${btoa(`${user.username}:${user.password}`)}`,
        },
    });
    const loginResponse = yield response.json();
    const loginMessage = loginResponse.message;
    console.log(loginMessage);
    const loginMessageParagraphId = "loginMessageParagraph";
    const loginForm = document.getElementById("login-form");
    const loginMessageParagraph = (_a = document.getElementById(loginMessageParagraphId)) !== null && _a !== void 0 ? _a : document.createElement("p");
    console.log(loginMessageParagraph);
    loginMessageParagraph.id.length !== 0
        ? loginMessageParagraph.id
        : (() => {
            console.log("running");
            loginForm === null || loginForm === void 0 ? void 0 : loginForm.appendChild(loginMessageParagraph);
            return loginMessageParagraphId;
        })();
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
    const form = document.getElementsByTagName("form")[0];
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const userNameElement = document.getElementById("user-name");
        const passwordElement = document.getElementById("password");
        const userDetails = {
            username: userNameElement.value,
            password: passwordElement.value,
        };
        requestLogin(userDetails);
    });
});
export {};

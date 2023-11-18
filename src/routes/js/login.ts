const LOGIN_USER_ROUTE = "/login-user";

const requestLogin = async (user: User) => {
	if (user.userName.length < 1 || user.password.length < 1) {
		Promise.reject(new Error("not given username or password"));
	}
	const stringifiedUser = JSON.stringify(user);
	console.log(stringifiedUser);
	const response = await fetch(LOGIN_USER_ROUTE, {
		method: "POST",
		body: stringifiedUser,
		headers: {
			"Content-Type": "text/javascript",
		},
	});
	const loginResponse = await response.json();
	const loginMessage: string = loginResponse.message;

	const loginMessageParagraphId = "loginMessageParagraph";
	const loginForm = document.getElementById("login-form");
	const loginMessageParagraph =
		document.getElementById(loginMessageParagraphId) ??
		document.createElement("p");
	if (!loginMessageParagraph.id) {
		loginMessageParagraph.id = loginMessageParagraphId;
		loginForm?.appendChild(loginMessageParagraph);
	}
	if (loginMessage === "success") {
		loginMessageParagraph.innerText = "Success!";
		loginMessageParagraph.style["color"] = "green";
	} else {
		loginMessageParagraph.innerText = "Fail";
		loginMessageParagraph.style["color"] = "red";
	}
};

window.addEventListener("load", (event) => {
	const loginButton = document.getElementById("login-button");
	loginButton?.addEventListener("click", (event): void => {
		event.preventDefault();
		const userNameElement = document.getElementById("user-name");
		const passwordElement = document.getElementById("password");

		if (
			userNameElement instanceof HTMLInputElement &&
			passwordElement instanceof HTMLInputElement
		) {
			const userDetails: User = {
				userName: userNameElement.value,
				password: passwordElement.value,
			};
			console.log(userDetails);

			requestLogin(userDetails);
		}
	});
});

const LOGIN_USER_ROUTE = "/login-user";

const requestLogin = async (user: User) => {
	if (user.username.length < 1 || user.password.length < 1) {
		Promise.reject(new Error("not given username or password"));
	}
	// const stringifiedUser = JSON.stringify(user);
	// console.log(stringifiedUser);
	const response = await fetch(LOGIN_USER_ROUTE, {
		method: "POST",
		// body: stringifiedUser,
		headers: {
			"Content-Type": "text/javascript",
			Authorization: `Basic ${btoa(`${user.username}:${user.password}`)}`,
		},
	});
	const loginResponse = await response.json();
	const loginMessage: string = loginResponse.message;

	console.log(loginMessage);

	const loginMessageParagraphId = "loginMessageParagraph";
	const loginForm = document.getElementById("login-form");
	const loginMessageParagraph =
		document.getElementById(loginMessageParagraphId) ??
		document.createElement("p");

	console.log(loginMessageParagraph);

	loginMessageParagraph.id.length !== 0
		? loginMessageParagraph.id
		: ((): string => {
				console.log("running");
				loginForm?.appendChild(loginMessageParagraph);
				return loginMessageParagraphId;
		  })();

	if (loginMessage === "success") {
		loginMessageParagraph.innerText = "Success!";
		loginMessageParagraph.style["color"] = "green";
	} else {
		loginMessageParagraph.innerText = "Fail";
		loginMessageParagraph.style["color"] = "red";
	}
};

window.addEventListener("load", (event) => {
	const loginButton = document.getElementById(
		"login-button"
	) as HTMLButtonElement;
	const form = document.getElementsByTagName("form")[0];

	form.addEventListener("submit", (event): void => {
		event.preventDefault();
		const userNameElement = document.getElementById(
			"user-name"
		) as HTMLInputElement;
		const passwordElement = document.getElementById(
			"password"
		) as HTMLInputElement;

		const userDetails: User = {
			username: userNameElement.value,
			password: passwordElement.value,
		};
		requestLogin(userDetails);
	});
});

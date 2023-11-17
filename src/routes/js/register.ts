const REGISTER_USER_ROUTE = "/register-user";

const requestRegistration = async (user: User) => {
	if (user.userName.length < 1 || user.password.length < 1) {
		Promise.reject(new Error("not given username or password"));
	}
	const stringifiedUser = JSON.stringify(user)
	console.log(stringifiedUser)
	const response = await fetch(REGISTER_USER_ROUTE, {
		method: "POST",
		body: stringifiedUser,
		headers: {
			'Content-Type': 'text/javascript'
		}
	});
	console.log(await response.json())
};

window.addEventListener("load", (event) => {
	const registerButton = document.getElementById("register-button");
	registerButton?.addEventListener("click", (event): void => {
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

			requestRegistration(userDetails);
		}
	});
});

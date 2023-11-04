const filesMetaDataToJSON = (files: FileList) => {
	return Object.keys(files).map((index) => {
		const file = files.item(parseInt(index));
		if (file) {
			return {
				name: file.name,
				lastModified: file.lastModified,
				size: file.size,
				type: file.type,
			};
		}
		return;
	});
};

window.addEventListener("load", () => {
	const selectedFile = document.getElementById("selected-file");
	const uploadButton = document.getElementById("upload-button");

	selectedFile?.addEventListener("input", (event) => {
		console.log("-------");
		console.log("Input Event:");
		console.log(event);
		if (selectedFile instanceof HTMLInputElement) {
			console.log("File List:");
			console.log(selectedFile.files);
		}
		console.log("-------");
	});
	selectedFile?.addEventListener("change", (event) => {
		console.log("-------");
		console.log("Change Event:");
		console.log(event);
		if (selectedFile instanceof HTMLInputElement) {
			console.log("File List:");
			console.log(selectedFile.files);
		}
		console.log("-------");
	});

	uploadButton?.addEventListener("click", async () => {
		if (
			selectedFile instanceof HTMLInputElement &&
			selectedFile.files?.length
		) {
			let request = new Request("test.txt", {
				method: "POST",
				body: JSON.stringify(filesMetaDataToJSON(selectedFile.files)),
			});
			const serverResponse = await fetch(request);
			console.log(serverResponse);
		}
	});
});

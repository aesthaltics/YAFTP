const UPLOAD_METADATA_ROUTE = "/file-metadata";
const UPLOAD_FILE_ROUTE = "/file-upload";

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

const sendMetaData = async (files: FileList) => {
	let request = new Request(UPLOAD_METADATA_ROUTE, {
		method: "POST",
		body: JSON.stringify(filesMetaDataToJSON(files)),
		headers: new Headers({
			'Content-Type': 'application/json'
		})
	});
	const serverResponse = await fetch(request);
	return await serverResponse.json();
};

const uploadFile = async (file: File, fileTransferID: string) => {
	// upload file url = /file_upload?id=${id}&file=${filename}
	const uploadURL = `${UPLOAD_FILE_ROUTE}?id=${fileTransferID}&file=${file.name}`;
	const fileReader = new FileReader();
	fileReader.onload = async (event) => {
		let request = new Request(uploadURL, {
			method: "POST",
			body: fileReader.result,
			headers: new Headers({
				"Content-Type": file.type,
			}),
		});
		const res = await fetch(request);
		console.log(await res.text());
	};
	fileReader.onerror = (event) => {
		console.log(`Could not read file ${file.name}`);
	};
	fileReader.readAsArrayBuffer(file);
};

const uploadFiles = async (files: FileList, fileTransferID: string) => {
	let promsises = []
	for (const file of files){
		promsises.push(uploadFile(file, fileTransferID))
	}
	return await Promise.all(promsises)
}

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
			console.log(
				JSON.stringify(filesMetaDataToJSON(selectedFile.files))
			);
			const fileTransferID = await sendMetaData(selectedFile.files);
			return await uploadFiles(selectedFile.files, fileTransferID)
		}
	});
});

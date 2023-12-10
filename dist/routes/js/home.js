var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const UPLOAD_METADATA_ROUTE = "/file-metadata";
const UPLOAD_FILE_ROUTE = "/file-upload";
const filesMetaDataToJSON = (files) => {
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
const sendMetaData = (files) => __awaiter(void 0, void 0, void 0, function* () {
    let request = new Request(UPLOAD_METADATA_ROUTE, {
        method: "POST",
        body: JSON.stringify(filesMetaDataToJSON(files)),
        headers: new Headers({
            'Content-Type': 'application/json'
        })
    });
    const serverResponse = yield fetch(request);
    return yield serverResponse.json();
});
const uploadFile = (file, fileTransferID) => __awaiter(void 0, void 0, void 0, function* () {
    // upload file url = /file_upload?id=${id}&file=${filename}
    const uploadURL = `${UPLOAD_FILE_ROUTE}?id=${fileTransferID}&file=${file.name}`;
    const fileReader = new FileReader();
    fileReader.onload = (event) => __awaiter(void 0, void 0, void 0, function* () {
        let request = new Request(uploadURL, {
            method: "POST",
            body: fileReader.result,
            headers: new Headers({
                "Content-Type": file.type,
            }),
        });
        const res = yield fetch(request);
        console.log(yield res.text());
    });
    fileReader.onerror = (event) => {
        console.log(`Could not read file ${file.name}`);
    };
    fileReader.readAsArrayBuffer(file);
});
const uploadFiles = (files, fileTransferID) => __awaiter(void 0, void 0, void 0, function* () {
    let promsises = [];
    for (const file of files) {
        promsises.push(uploadFile(file, fileTransferID));
    }
    return yield Promise.all(promsises);
});
window.addEventListener("load", () => {
    const selectedFile = document.getElementById("selected-file");
    const uploadButton = document.getElementById("upload-button");
    selectedFile === null || selectedFile === void 0 ? void 0 : selectedFile.addEventListener("input", (event) => {
        console.log("-------");
        console.log("Input Event:");
        console.log(event);
        if (selectedFile instanceof HTMLInputElement) {
            console.log("File List:");
            console.log(selectedFile.files);
        }
        console.log("-------");
    });
    selectedFile === null || selectedFile === void 0 ? void 0 : selectedFile.addEventListener("change", (event) => {
        console.log("-------");
        console.log("Change Event:");
        console.log(event);
        if (selectedFile instanceof HTMLInputElement) {
            console.log("File List:");
            console.log(selectedFile.files);
        }
        console.log("-------");
    });
    uploadButton === null || uploadButton === void 0 ? void 0 : uploadButton.addEventListener("click", () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        if (selectedFile instanceof HTMLInputElement &&
            ((_a = selectedFile.files) === null || _a === void 0 ? void 0 : _a.length)) {
            console.log(JSON.stringify(filesMetaDataToJSON(selectedFile.files)));
            const fileTransferID = yield sendMetaData(selectedFile.files);
            return yield uploadFiles(selectedFile.files, fileTransferID);
        }
    }));
});
export {};

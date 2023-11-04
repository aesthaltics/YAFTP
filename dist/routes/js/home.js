"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
            let request = new Request("test.txt", {
                method: "POST",
                body: JSON.stringify(filesMetaDataToJSON(selectedFile.files)),
            });
            const serverResponse = yield fetch(request);
            console.log(serverResponse);
        }
    }));
});

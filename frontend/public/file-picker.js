document.addEventListener("DOMContentLoaded", function () {
  const fileInput = document.getElementById("fileInput");
  const fileInfo = document.getElementById("fileInfo");
  const saveButton = document.getElementById("saveButton");
  const cancelButton = document.getElementById("cancelButton");

  let selectedFile = null;

  fileInput.addEventListener("change", function (event) {
    selectedFile = event.target.files[0];
    if (selectedFile) {
      fileInfo.textContent = `Selected: ${selectedFile.name} (${formatFileSize(
        selectedFile.size
      )})`;
      saveButton.disabled = false;
    } else {
      fileInfo.textContent = "";
      saveButton.disabled = true;
    }
  });

  saveButton.addEventListener("click", function () {
    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = function () {
        const fileData = {
          name: selectedFile.name,
          type: selectedFile.type,
          size: selectedFile.size,
          lastModified: selectedFile.lastModified,
          dataUrl: reader.result,
        };
        browser.runtime
          .sendMessage({
            action: "saveSelectedFileData",
            fileData: fileData,
          })
          .then(() => {
            window.close(); // Close the popup
          })
          .catch((err) => {
            console.error("Error saving file data:", err);
          });
      };
      reader.readAsDataURL(selectedFile);
    }
  });

  cancelButton.addEventListener("click", function () {
    window.close(); // Simply close the popup
  });

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " bytes";
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }
});

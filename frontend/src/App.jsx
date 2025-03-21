import "./style/popup.css";
import { useEffect, useState, useRef } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import Loading from "react-simple-loading";
import Modal from "react-modal";
import { put } from "@vercel/blob";
import axios from "axios";
import useWebSocket from "react-use-websocket";
import UploadProgress from "./component/UploadProgress";
const customStyles = {
  content: {
    top: "50%",
    left: "50%",
    right: "auto",
    bottom: "auto",
    marginRight: "-50%",
    transform: "translate(-50%, -50%)",
    height: "20rem",
    width: "25rem",
    padding: "24px",
    borderRadius: "8px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  },
};

Modal.setAppElement("#root");

function App() {
  const [status, setStatus] = useState(
    "Select a start date, optionally an end date, and click the button."
  );
  const [loading, setLoading] = useState(false);
  const [syncCount, setSyncCount] = useState(0);
  const [emailsToSync, setEmailsToSync] = useState(100);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [file, setFile] = useState({
    size: null,
  });
  const [loadingType, setLoadingType] = useState("uploadProgress");
  const [fileSelectionUrl, setFileSelectionUrl] = useState(null);
  const [dataType, setDataType] = useState("dataset");
  const process = browser.runtime.getManifest().browser_specific_settings;
  const backendUrl = process.env.backend_url;
  const sessionId = localStorage.getItem("sessionId")

  const checkForSelectedFile = () => {
    browser.runtime
      .sendMessage({ action: "getPendingUploadData" })
      .then((response) => {
        if (response) {
          const fileData = response;
          const name = fileData.name;
          const type = fileData.type;
          const dataUrl = fileData.dataUrl;
          // Convert dataUrl back to a File object
          // const { name, type, dataUrl } = fileData;

          // Extract base64 data from dataUrl
          const base64Data = dataUrl.split(",")[1];
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          // Create file from array buffer
          const blob = new Blob([bytes.buffer], { type });
          const fileObj = new File([blob], name, { type });

          setFile(fileObj);
        }
      });
  };

  const openFileSelector = () => {
    setDataType("dataset");
    setLoadingType("uploadProgress");
    if (fileSelectionUrl) {
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;

      const popupWidth = 400;
      const popupHeight = 300;

      const left = (screenWidth - popupWidth) / 2;
      const top = (screenHeight - popupHeight) / 2;

      browser.windows.create({
        url: fileSelectionUrl,
        width: popupWidth,
        height: popupHeight,
        left: Math.round(left),
        top: Math.round(top),
        type: "popup",
      });
    } else {
      setStatus("Error: Cannot create file selector");
    }
  };

  const formik = useFormik({
    initialValues: {
      startDate: "",
      endDate: "",
    },
    validationSchema: Yup.object({
      startDate: Yup.string().required("Start date is required"),
    }),
    onSubmit: async (values) => {
      setStatus("Processing emails...");
      setLoadingType("loading");
      setLoading(true);
      await browser.runtime
        .sendMessage({
          action: "startProcessing",
          startDate: values.startDate,
          endDate: values.endDate,
        })
        .then((response) => {
          // console.log("[SUCCESS] Background script responded:", response);
          setLoading(false);
          setLoadingType("UploadProgress");
          setStatus("Emails processed successfully! Check the Drafts folder.");
        })
        .catch((error) => {
          setLoading(false);

          console.error(
            "[ERROR] Failed to communicate with background script:",
            error
          );
          setStatus("Error processing emails. See console for details.");
        });
    },
  });

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " bytes";
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  const handleUpload = async () => {
    if (!file) {
      return;
    }
    setLoading(true);
    setStatus("Uploading file...");
    try {
      const formData = new FormData();
      formData.append("datasetFile", file);
      formData.append("sessionId",sessionId);
      const response = await axios.post(
        `${backendUrl}/api/upload-dataset`,
        formData
      );
      if(response.status!=200){
        setStatus("Error uploading file")
      }else{
      localStorage.setItem("fileName",file.name)
      setStatus(`File uploaded successfully: ${file.name}`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      setStatus("Error uploading file. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  const stopProcessing = () => {
    // console.log("Stopping email processing...");
    setStatus("Email processing stopped.");
    setLoading(true);

    browser.runtime
      .sendMessage({ action: "stopProcessing" })
      .then((response) => {
        setLoading(false);
        // console.log("[SUCCESS] Background script responded:", response);
      })
      .catch((error) => {
        setLoading(false);
        console.error("[ERROR] Failed to stop processing:", error);
      });
  };

  const startReadingUserEmails = async () => {
    setModalIsOpen(false);
    setDataType("writingStyle");
    setLoadingType("uploadProgress");
    // console.log("Starting to read users emails");
    setLoading(true);
    setStatus("Analyzing user writing style");

    try {
      const response = await browser.runtime.sendMessage({
        action: "analyzeUserEmails",
        data: emailsToSync,
      });

      if (response) {
        // console.log("Response received:", response);
        setStatus("User emails analyzed successfully");
        localStorage.setItem("syncCount", response.response);
        // console.log(response);
        setSyncCount(response.response);
      } else {
        setStatus("Unexpected error");
      }
    } catch (err) {
      setStatus("Emails analyzing failed");
    } finally {
      setLoading(false);
    }
  };

  const clearUserEmailsHistory = () => {
    setStatus("Clearing User Email History");
    setLoadingType("loading");
    setLoading(true);
    localStorage.removeItem("syncCount");
    browser.runtime
      .sendMessage({ action: "clearEmailsHistory" })
      .then((res) => {
        setLoading(false);
        setSyncCount(0);
        setStatus("Email History cleared");
      })
      .catch((err) => {
        setLoading(false);

        console.error("Error ", err);
        setStatus("Failed clearing history");
      });
  };

  function openModal() {
    setModalIsOpen(true);
  }

  function closeModal() {
    setModalIsOpen(false);
  }

  function logSession() {
    // console.log("Session ID: ", localStorage.getItem("sessionId"));
    // console.log("File Name: ", localStorage.getItem("fileName"));
    // console.log("URL: ", localStorage.getItem("url"));
    // console.log("Download URL: ", localStorage.getItem("downloadUrl"));
  }

  async function removeDataset() {
    setLoadingType("loading");
    setLoading(true);
    // console.log("remove dataset");
    const response = await axios.post(`${backendUrl}/api/remove-dataset`, {
      sessionId: localStorage.getItem("sessionId"),
    });
    setFile({
      name: null,
      size: null,
    });
    localStorage.removeItem("fileName");
    setLoading(false);
  }

  useEffect(() => {
    const sync = localStorage.getItem("syncCount");
    const uploadedFile = localStorage.getItem("fileName");
    if (uploadedFile)
      setFile({
        name: uploadedFile,
        size: null,
      });
    if (sync) setSyncCount(sync);
  }, []);

  useEffect(() => {
    browser.runtime
      .sendMessage({ action: "createTempFileHandler" })
      .then((response) => {
        if (response && response.tempFilePath) {
          setFileSelectionUrl(response.tempFilePath);
        } else {
          console.error("No tempFilePath returned:", response);
        }
      })
      .catch((err) => {
        console.error("Error creating file handler:", err);
        setStatus("Error: Cannot create file selector - " + err.message);
      });
    checkForSelectedFile();
  }, []);

  useEffect(() => {
    browser.runtime
      .sendMessage({ action: "getSelectedFile" })
      .then((response) => {
        if (response && response.file) {
          setSelectedFileData(response.file);

          const { name, type, dataUrl, lastModified } = response.file;
          const base64Data = dataUrl.split(",")[1];
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const blob = new Blob([bytes.buffer], { type });
          const fileObj = new File([blob], name, { type, lastModified });

          setFile(fileObj);
          setStatus(`File selected: ${name}`);

          browser.runtime.sendMessage({ action: "clearSelectedFile" });
        }
      });
  }, []);

  useEffect(async () => {
    if (
      localStorage.getItem("sessionId") == null ||
      localStorage.getItem("sessionId") == ""
    ) {
      const res = await axios.post(`${backendUrl}/api/register-session`);
      localStorage.setItem("sessionId", res.data.sessionId);
    }
  }, []);

  useEffect(() => {
    if (file.size != null) {
      handleUpload();
    }
  }, [file]);

  return (
    <>
      <h1 id="title">AI Email Responder</h1>
      {loading && (
        <>
          <div id="loading-overlay">
            {loadingType == "uploadProgress" ? (
              <UploadProgress
                sessionId={localStorage.getItem("sessionId")}
                fileName={file.name}
                emailsToSync={emailsToSync}
                dataType={dataType}
              />
            ) : (
              <Loading id="loader" />
            )}
          </div>
        </>
      )}
      <div className={`form-container ${loading ? "blur" : ""}`}>
        <form onSubmit={formik.handleSubmit}>
          <div className="date-group">
            <label htmlFor="startDate">Start Date:</label>
            <input
              type="date"
              id="startDate"
              name="startDate"
              value={formik.values.startDate}
              onChange={formik.handleChange}
              disabled={loading}
            />
          </div>
          {formik.touched?.startDate && formik.errors?.startDate && (
            <div className="p-error">{formik.errors?.startDate}</div>
          )}
          <div className="date-group">
            <label htmlFor="endDate">End Date:</label>
            <input
              type="date"
              id="endDate"
              name="endDate"
              value={formik.values.endDate}
              onChange={formik.handleChange}
              disabled={loading}
            />
          </div>

          <div id="btn-container">
            <button type="submit" className="primary" disabled={loading}>
              Process Inbox Emails
            </button>
            <button
              type="button"
              className="danger"
              onClick={stopProcessing}
              disabled={loading}
            >
              Stop
            </button>
            <div className="sync-info">
              <span>Emails Synced:</span>
              <span id="sync-count">{syncCount}</span>
            </div>
            <button
              type="button"
              className="success"
              onClick={openModal}
              disabled={loading}
            >
              Analyze Writing Style
            </button>
            <button
              type="button"
              className="danger"
              onClick={clearUserEmailsHistory}
              disabled={loading}
            >
              Clear History
            </button>
          </div>
        </form>

        <div>
          <button
            type="button"
            onClick={openFileSelector}
            className="file-selector-btn"
            disabled={loading}
          >
            +
          </button>
          {file.name != null && (
            <span className="file-info">
              Selected: {file.name}{" "}
              {file.size ? `(${formatFileSize(file.size)})` : ""}
              <button
                type="button"
                onClick={removeDataset}
                className="remove-file-btn"
                disabled={loading}
              >
                X
              </button>
            </span>
          )}
        </div>
      </div>
      {/* <button onClick={logSession}>Log</button> */}

      {/* <button
        onClick={getUploadedDataset}
        className="dataset-btn"
        disabled={loading}
      >
        Get Dataset
      </button> */}

      <p id="status">{status}</p>
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        style={customStyles}
        contentLabel="Emails to Sync"
      >
        <div className="modal-container">
          <div className="modal-header">Emails to Sync</div>
          <form className="modal-form">
            <input
              type="number"
              value={emailsToSync}
              onChange={(e) => setEmailsToSync(e.target.value)}
              className="count"
              placeholder="Enter number of emails"
            />
          </form>
          <div className="button-group">
            <button onClick={closeModal} className="danger">
              Cancel
            </button>
            <button onClick={startReadingUserEmails} className="success">
              Proceed
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default App;

import React, { useState, useEffect } from "react";
import useWebSocket from "react-use-websocket";
import "./UploadProgress.css"; // External CSS file

const UploadProgress = ({ sessionId, fileName, dataType, emailsToSync }) => {
  const [progress, setProgress] = useState(0);
  const process = browser.runtime.getManifest().browser_specific_settings;
  const wsUrl = process.env.ws_url;
  // console.log("Loading", sessionId);
  // Connect to WebSocket server

  useWebSocket(`${wsUrl}`, {
    onMessage: (event) => {
      const data = JSON.parse(event.data);
      if (data.sessionId === sessionId) {
        setProgress(data.progress);
      }
    },
  });

  return (
    <div className="progress-container">
      <span>
        {dataType == "dataset"
          ? `Uploading Dataset File: ${fileName}`
          : `Analyzing and Uploading Writing style: ${emailsToSync}`}{" "}
      </span>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }}>
          <span className="progress-text"> {progress.toFixed(2)}%</span>
        </div>
      </div>
      {progress === 100 && <p className="success-text">Upload Completed ✅</p>}
    </div>
  );
};

export default UploadProgress;

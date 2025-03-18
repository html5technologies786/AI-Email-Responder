import React, { useState, useEffect } from "react";
import useWebSocket from "react-use-websocket";
import "./UploadProgress.css"; // External CSS file

const UploadProgress = ({ sessionId, fileName, dataType, emailsToSync }) => {
  const [progress, setProgress] = useState(0);
  const wsUrl = "ws://74.249.58.8:8080";
  console.log("Loading", sessionId);
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

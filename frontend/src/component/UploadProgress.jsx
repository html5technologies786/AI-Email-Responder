import React, { useState, useEffect } from "react";
import useWebSocket from "react-use-websocket";
import "./UploadProgress.css"; // External CSS file

const UploadProgress = ({ sessionId,fileName }) => {
  const [progress, setProgress] = useState(0);
  console.log("Loading", sessionId);
  // Connect to WebSocket server

  useWebSocket(`ws://${process.env.VITE_SOCKET_URL}`, {
    onMessage: (event) => {
      const data = JSON.parse(event.data);
      if (data.sessionId === sessionId) {
        setProgress(data.progress);
      }
    },
  });

  return (
    <div className="progress-container">
      <span>{fileName}</span>
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

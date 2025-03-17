import React, { useState, useEffect } from "react";
import useWebSocket from "react-use-websocket";
import "./UploadProgress.css"; // External CSS file

const UploadProgress = ({ sessionId }) => {
  const [progress, setProgress] = useState(0);

  // Connect to WebSocket server
  useWebSocket("ws://localhost:8080", {
    onMessage: (event) => {
      const data = JSON.parse(event.data);
      if (data.sessionId === sessionId) {
        setProgress(data.progress);
      }
    },
  });

  return (
    <div className="progress-container">
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

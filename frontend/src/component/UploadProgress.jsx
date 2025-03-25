import { useState } from "react";
import useWebSocket from "react-use-websocket";
import "./UploadProgress.css"; // External CSS file

const UploadProgress = ({ sessionId, fileName, dataType, emailsToSync }) => {
  const [progress, setProgress] = useState(0);
    const [secondProgress,setSecondProgress] = useState(0);
  const wsUrl = "ws://localhost:8080";
  useWebSocket(wsUrl, {
    onMessage: (event) => {
      const data = JSON.parse(event.data);
      if (data.sessionId === sessionId) {
          if(data.type == "embedding"){
        setProgress(data.progress);
          }else if (data.type == "uploading"){
              setSecondProgress(data.progress)
          }else{
              setProgress(data.progress)
          }
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
      {dataType == "dataset" ? (
          <>
          <span>Training AI on received data</span>
                <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${secondProgress}%` }}>
          <span className="progress-text"> {secondProgress.toFixed(2)}%</span>
        </div>
      </div>
      {secondProgress=== 100 && <p className="success-text">Upload Completed ✅</p>}

          </>
      ):""}
      {secondProgress=== 100 && <p className="success-text">Training Completed ✅</p>}
    </div>
  );
};

export default UploadProgress;

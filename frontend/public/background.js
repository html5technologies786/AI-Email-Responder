const process = browser.runtime.getManifest().browser_specific_settings;
let stopRequested = false;
let isProcessing = false;
let trainingEmails = [];
let emailsToSync = 100;
let storedFile = null;
let selectedFile = null;
let pendingUploadData = null;
let pendingFileSelection = false;
let sessionId = localStorage.getItem("sessionId");
let backendUrl = process.env.backend_url;

async function generateAIResponse(emailBody, history) {
  try {
    // let userEmails = await ReadContext();
    console.log("[INFO] Sending request to OpenAI...");
    const requestBody = {
      conversationHistory: history,
      email: emailBody,
      sessionId: localStorage.getItem("sessionId"),
    };
    const response = await fetch(`${backendUrl}/api/process-emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log("[DEBUG] OpenAI API Response Status:", response.status);

    const data = await response.json();
    console.log("[DEBUG] OpenAI API Response Data:", data);
    return data;
  } catch (error) {
    console.error("[ERROR] Error generating AI response:", error);
    return "Error generating AI response.";
  }
}

const getRecentEmails = async (fromDate, toDate, stopRequested) => {
  const emails = [];
  try {
    console.log(
      `[INFO] Querying emails from: ${fromDate.toISOString()} to ${toDate.toISOString()}`
    );

    const accounts = await browser.accounts.list();
    if (accounts.length === 0) {
      console.error("[ERROR] No accounts found!");
      return emails;
    }

    const targetAccount = accounts.find((account) => account.type !== "none");
    if (!targetAccount) {
      console.error("[ERROR] No valid email accounts found!");
      return emails;
    }

    const inboxFolder = targetAccount.folders.find(
      (folder) => folder.type === "inbox"
    );
    if (!inboxFolder) {
      console.error(
        `[ERROR] Inbox folder not found for account: ${targetAccount.name}`
      );
      return emails;
    }

    const queryInfo = {
      folderId: inboxFolder.id,
      fromDate: fromDate,
      toDate: toDate,
      messagesPerPage: 100,
    };

    let page = await browser.messages.query(queryInfo);
    let totalFetched = 0;
    let counter = 1;

    while (!stopRequested) {
      if (!page.messages || page.messages.length === 0) {
        console.log(`[INFO] No messages found on page ${counter}.`);
        break;
      }

      console.log(
        `[INFO] Messages fetched from page ${counter}: ${page.messages.length}`
      );
      counter += 1;
      for (const message of page.messages) {
        if (stopRequested) {
          console.log(
            "[INFO] Stop requested, aborting in the middle of page processing."
          );
          return emails;
        }

        const fullMessage = await browser.messages.get(message.id);
        emails.push({
          id: message.id,
          email: fullMessage.author,
          title: fullMessage.subject || "No Subject",
          body: fullMessage.body || "No Content",
          date: fullMessage.date,
        });
        totalFetched++;
      }

      if (!page.id) {
        console.log("[INFO] No more pages of messages.");
        break;
      }

      console.log("[INFO] Fetching next page...");
      page = await browser.messages.continueList(page.id);
    }

    console.log(`[INFO] Total messages fetched: ${totalFetched}`);
    return emails;
  } catch (error) {
    console.error("[ERROR] Error fetching recent emails:", error);
    return emails;
  }
};

function filterNoReplyEmails(emails) {
  const filteredEmails = emails.filter((email) => {
    const senderEmail = (email.email || "").toLowerCase();
    return !(
      senderEmail.includes("noreply") || senderEmail.includes("no-reply")
    );
  });

  console.log(
    `[INFO] Filtered emails (removed no-reply): ${filteredEmails.length}`
  );
  return filteredEmails;
}

async function extractMessageBody(part) {
  if (part.contentType === "text/plain" && part.body) {
    return part.body;
  }

  if (part.parts && part.parts.length > 0) {
    for (const subPart of part.parts) {
      const result = await extractMessageBody(subPart);
      if (result && result !== "No Content") {
        return result;
      }
    }
  }

  return "No Content";
}

async function fetchEmailBodies(emails) {
  for (let email of emails) {
    try {
      // Check if stop was requested before fetching the body
      if (stopRequested) {
        console.log(
          "[INFO] Stop requested, aborting fetchEmailBodies process."
        );
        break;
      }
      const fullMessage = await browser.messages.getFull(email.id);
      const body = await extractMessageBody(fullMessage);
      email.body = body;
    } catch (err) {
      console.error("[ERROR] Error fetching full message details:", err);
      email.body = "No Content";
    }
  }
  console.log(`[INFO] Processed full bodies for ${emails.length} emails`);
  return emails;
}

async function draftReplyEmails(emails) {
  for (const [index, email] of emails.entries()) {
    if (stopRequested) {
      console.log("[INFO] Stop requested, aborting the drafting process.");
      break;
    }
    console.log("EMAIL: ", email);
    let conversationHistory = await getConversationHistory(
      email.email,
      email.title
    );
    try {
      console.log(`[INFO] Drafting reply for email ${index + 1}`);
      const aiResponse = await generateAIResponse(
        email.body,
        conversationHistory
      );
      console.log(`AI response: ${aiResponse.answer + aiResponse.similarity}`);
      const eBody = `${aiResponse.answer} \n ${aiResponse.similarity}`;
      const draftDetails = {
        to: [email.email],
        subject: `Re: ${email.title}`,
        body: `<html><body>${eBody.replace(/\n/g, "<br>")}</body></html>`,
      };
      if (stopRequested) {
        console.log(
          "[INFO] Stop requested after generating AI response, aborting."
        );
        break;
      }
      // await saveDraftInDraftsFolder(draftDetails);
      const composeTab = await browser.compose.beginNew(draftDetails);
      await browser.windows.update(composeTab.windowId, { state: "minimized" });
      const saveResult = await browser.compose.saveMessage(composeTab.id, {
        mode: "draft",
      });
      console.log(
        `[INFO] Draft reply ${index + 1} saved successfully:`,
        saveResult
      );

      await browser.windows.remove(composeTab.windowId);
    } catch (error) {
      console.error(
        `[ERROR] Error drafting reply for email ${index + 1}:`,
        error
      );
    }
  }

  console.log("[INFO] All replies drafted and windows closed.");
}

async function saveDraftInDraftsFolder(draftDetails) {
  // Get the account and Drafts folder
  const accounts = await browser.accounts.list();
  const accountId = accounts[0].id; // Use the right account
  const draftFolder = (
    await browser.mailFolders.getMailFolderByName(accountId, "Drafts")
  ).path;

  // Construct a message object from ComposeDetails
  const message = {
    subject: draftDetails.subject || "",
    plainTextBody: draftDetails.plainTextBody || draftDetails.body || "",
    to: draftDetails.to || [],
    folder: draftFolder,
  };

  // Create the message in the Drafts folder
  const messageId = await browser.messages.create(accountId, message);
  console.log("[INFO] Draft created directly:", messageId);
}

export async function processEmailsAndDraftReplies(
  startDateString,
  endDateString
) {
  try {
    console.log("[INFO] Starting email processing...");

    let fromDate = startDateString ? new Date(startDateString) : new Date();
    let toDate = endDateString ? new Date(endDateString) : new Date();

    console.log(
      `[INFO] Using fromDate: ${fromDate.toISOString()}, toDate: ${toDate.toISOString()}`
    );
    const emails = await getRecentEmails(fromDate, toDate, stopRequested);
    if (!emails) throw new Error("Failed to fetch emails.");

    if (emails.length === 0) {
      console.log("[INFO] No emails found from the selected period.");
      return;
    }

    const filteredEmails = filterNoReplyEmails(emails);
    if (!filteredEmails) throw new Error("Failed to filter emails.");

    if (filteredEmails.length === 0) {
      console.log("[INFO] No non-no-reply emails found.");
      return;
    }

    await fetchEmailBodies(filteredEmails);
    const finalEmails = filteredEmails.filter(
      (email) => email.body && email.body.trim() !== "No Content"
    );

    if (finalEmails.length === 0) {
      console.log(
        "[INFO] All remaining emails have no content, nothing to reply to."
      );
      return;
    }

    console.log(
      `[INFO] Drafting replies for the emails with appropriate body : ${finalEmails.length}`
    );

    await draftReplyEmails(finalEmails);

    console.log("[INFO] Email processing completed.");
  } catch (error) {
    console.error("[ERROR] An error occurred while processing emails:", error);
    throw error;
  }
}

export async function getConversationHistory(email, subject) {
  console.log("EMAIL FOR CONVERSATION:", email);
  console.log("Subject FOR CONVERSATION:", subject);

  let sentHistory = [];
  let receiveHistory = [];

  const accounts = await browser.accounts.list();
  if (accounts.length === 0) {
    console.error("[ERROR] No accounts found!");
    return history;
  }

  const targetAccount = accounts.find((account) => account.type !== "none");
  if (!targetAccount) {
    console.error("[ERROR] No valid email accounts found!");
    return history;
  }

  const inboxFolder = targetAccount.folders.find(
    (folder) => folder.type === "inbox"
  );

  const allFolders = targetAccount.folders;
  let targetFolder = allFolders.find((folder) => folder.name === "[Gmail]");
  let fullFolder = await browser.folders.get(targetFolder.id, true);
  let sentFolder = fullFolder.subFolders.find(
    (folder) => folder.name === "Sent Mail"
  );

  if (!inboxFolder) {
    console.error(
      `[ERROR] Inbox folder not found for account: ${targetAccount.name}`
    );
    return history;
  }

  const sentQuery = {
    folderId: sentFolder.id,
    subject: subject,
    author: "saadofficial0999@gmail.com",
    recipients: email,
  };

  const recieveQuery = {
    folderId: inboxFolder.id,
    subject: subject,
    author: email,
    recipients: "saadofficial0999@gmail.com",
  };

  while (true) {
    let sentPage = await browser.messages.query(sentQuery);
    let receivePage = await browser.messages.query(recieveQuery);

    for (const message of sentPage.messages) {
      const fullMessage = await browser.messages.get(message.id);

      sentHistory.push({
        id: message.id,
        email: fullMessage.author,
        title: fullMessage.subject || "No Subject",
        body: fullMessage.body || "No Content",
        date: fullMessage.date,
      });
    }

    for (const message of receivePage.messages) {
      const fullMessage = await browser.messages.get(message.id);

      receiveHistory.push({
        id: message.id,
        email: fullMessage.author,
        title: fullMessage.subject || "No Subject",
        body: fullMessage.body || "No Content",
        date: fullMessage.date,
      });
    }

    if (!sentPage.id && !receivePage.id) {
      console.log("[INFO] No more pages of messages.");
      break;
    }

    console.log("[INFO] Fetching next page...");
    sentPage = await browser.messages.continueList(sentPage.id);
    receivePage = await browser.messages.continueList(receivePage.id);
  }
  const wholeHistory = sentHistory.concat(receiveHistory);
  for (let email of wholeHistory) {
    const fullMessage = await browser.messages.getFull(email.id);
    const body = await extractMessageBody(fullMessage);
    email.body = body;
  }
  console.log("WHOLE HISTORY LENGTH:", wholeHistory.length);
  return wholeHistory;
}

export async function stopEmailProcessing() {
  stopRequested = true;
}

async function ReadContext() {
  let sentMessages = [];

  // Utility function to retry failed operations
  async function retryOperation(operation, maxRetries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (error.message?.includes("other side closed connection")) {
          if (attempt === maxRetries) {
            throw new Error(
              `Failed after ${maxRetries} attempts: ${error.message}`
            );
          }
          console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          // Increase delay for next attempt
          delay *= 2;
        } else {
          throw error; // Don't retry other types of errors
        }
      }
    }
  }

  try {
    let accounts = (await messenger.accounts.list()).filter(
      (account) => account.type !== "none"
    );

    for (let account of accounts) {
      let allFolders = [
        ...account.folders,
        ...account.folders.flatMap((folder) => folder.subFolders || []),
      ];

      let sentFolder = allFolders.find((folder) =>
        ["Sent", "Sent Mail", "Sent Items", "Outbox"].includes(folder.name)
      );

      if (!sentFolder) {
        console.warn(`No Sent folder found for account: ${account.name}`);
        continue;
      }

      const getSentList = async () => {
        let messages;
        let countSyncedMessages = [];
        let page = await messenger.messages.list(sentFolder.id);
        messages = page.messages;
        if (messages.length < emailsToSync && page.id != undefined) {
          while (page.id) {
            page = await messenger.messages.continueList(page.id);
            messages = messages.concat(page.messages);
          }
        }
        for (let i = 0; i < emailsToSync; i++) {
          if (messages[i] != undefined) {
            countSyncedMessages.push(messages[i]);
          }
        }
        messages = countSyncedMessages;
        return messages;
      };

      // Get messages list with retry
      const messages = await retryOperation(getSentList);
      console.log("INFO messages from sent inbox", messages);
      // Process messages in smaller batches to avoid overwhelming the connection
      const batchSize = 5;
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);

        // Process batch in parallel with individual retries
        const batchPromises = batch.map(async (message) => {
          try {
            const fullMessage = await retryOperation(() =>
              messenger.messages.getFull(message.id)
            );

            let messageBody = "";
            if (fullMessage?.parts?.[0]) {
              if (fullMessage.parts[0].body) {
                messageBody = fullMessage.parts[0].body;
              } else if (fullMessage.parts[0].parts?.[0]?.body) {
                messageBody = fullMessage.parts[0].parts[0].body;
              }
            }

            if (messageBody) {
              return messageBody;
            } else {
              console.warn(`No body found for message: ${message.id}`);
              return null;
            }
          } catch (messageError) {
            console.error(
              `Error processing message ${message.id}:`,
              messageError
            );
            return null;
          }
        });

        // Wait for batch to complete and filter out nulls
        const batchResults = (await Promise.all(batchPromises)).filter(Boolean);
        sentMessages.push(...batchResults);

        // Add a small delay between batches to prevent overload
        if (i + batchSize < messages.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }
    return sentMessages;
  } catch (error) {
    console.error("Failed to process emails:", error);
    throw error;
  }
}

async function saveDraftInvisibly(draftDetails) {
  const composeTab = await browser.compose.beginNew(draftDetails);

  // Move window off-screen and minimize immediately
  await browser.windows.update(composeTab.windowId, {
    left: -10000, // Far off-screen
    top: -10000,
    state: "minimized",
  });

  const saveResult = await browser.compose.saveMessage(composeTab.id, {
    mode: "draft",
  });
  console.log("[INFO] Draft saved:", saveResult);

  await browser.windows.remove(composeTab.windowId);
}

async function uploadWritingStyle() {
  const obj = {
    writingStyle: trainingEmails,
    sessionId: localStorage.getItem("sessionId"),
  };
  const response = await fetch(`${backendUrl}/api/upload-writing-style`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(obj),
  });
  const data = await response.json();
  return data.message;
}

async function uploadDataset(url) {
  const obj = {
    url: url,
    sessionId: localStorage.getItem("sessionId"),
  };
  const response = await fetch(`${backendUrl}/api/upload-dataset`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(obj),
  });
  const data = await response.json();
  console.log("BACKEND RESPONSE: ", data);
  return data.message;
}

async function clearEmailHistory() {
  const response = await fetch(`${backendUrl}/api/clear-writing-style`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId: sessionId,
    }),
  });
  const data = response.status;
  return data;
}

browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  let response;
  if (message.action === "startProcessing") {
    if (isProcessing) {
      sendResponse({ status: "Already processing" });
      return;
    }
    isProcessing = true;

    await processEmailsAndDraftReplies(message.startDate, message.endDate)
      .then(() => {
        console.log("[SUCCESS] Email processing completed.");
        isProcessing = false;
        // browser.runtime.sendMessage({ action: "processingCompleted" });
      })
      .catch((error) => {
        console.error("[ERROR] Failed to process emails:", error);
        isProcessing = false;
        sendResponse({ response: "failed to process emails" });
        // browser.runtime.sendMessage({ action: "processingError" });
      });

    sendResponse({ status: "Started processing" });
  } else if (message.action === "stopProcessing") {
    stopEmailProcessing();
    isProcessing = false;
    sendResponse({ status: "Stopped processing" });
  } else if (message.action == "analyzeUserEmails") {
    console.log("Emails to Sync:", message.data);
    emailsToSync = message.data;
    console.log("Analyzing user email writing style");
    await ReadContext()
      .then((res) => {
        if (!res || !Array.isArray(res)) {
          console.error("Invalid response format:", res);
          return sendResponse({ status: "Invalid response format" });
        }

        trainingEmails = res;
        response = res.length;
        sendResponse({ status: true, data: response });
      })
      .catch((error) => {
        console.error("[ERROR] Failed to process emails:", error);
        isProcessing = false;
        sendResponse({ response: "failed to process emails" });
      });
    const msg = await uploadWritingStyle();

    return { response, msg };
  } else if (message.action == "clearEmailsHistory") {
    trainingEmails = [];
    console.log("Email History cleared");
    console.log(trainingEmails.length);
    const status = await clearEmailHistory();
    return status;
  } else if (message.action === "getPendingUploadData") {
    const data = selectedFile;
    sendResponse({ response: data });
    return data;
  } else if (message.action === "getSelectedFile") {
    const response = {
      file: selectedFile,
    };
    selectedFile = null;
    sendResponse(response);
    return true;
  }
  //  else if (message.action === "clearSelectedFile") {
  //   selectedFile = null;
  //   sendResponse({ success: true });
  //   return true;
  // }
  else if (message.action === "saveSelectedFileData") {
    console.log("Background: ", message);
    selectedFile = message.fileData;
    pendingFileSelection = true;
    sendResponse({ success: true });
    return true;
  } else if (message.action === "createTempFileHandler") {
    try {
      const tempFilePath = createFileSelectionHTML();
      return Promise.resolve({ tempFilePath });
    } catch (err) {
      console.error("Error creating temp file:", err);
      return Promise.resolve({ error: err.message });
    }
  } else if (message.action === "storeUploadedFile") {
    console.log(message.url);
    await uploadDataset(message.url);
    return true;
  }
});

function createFileSelectionHTML() {
  return browser.runtime.getURL("file-picker.html");
}

browser.windows.onRemoved.addListener((windowId) => {
  if (pendingFileSelection) {
    setTimeout(() => {
      browser.browserAction.openPopup();
      pendingFileSelection = false;
    }, 300);
  }
});

console.log("[DEBUG] Background script loaded and running...");
// await getConversationHistory("saadsubuan@gmail.com");

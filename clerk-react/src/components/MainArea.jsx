import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Stack,
  Avatar,
  Divider,
  Snackbar,
  Skeleton,
  Chip,
  CircularProgress,
  Tooltip,
} from "@mui/material";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import SummarizeIcon from "@mui/icons-material/Summarize";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DescriptionIcon from "@mui/icons-material/Description"; // doc/docx/txt fallback

import ChatWindow from "./ChatWindow"

import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import dayjs from "dayjs";

import "../scss/MainArea.scss";

const MainArea = ({ refresh }) => {
  const { getToken } = useAuth();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [chatOpen, setChatOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [savingChatLoading, setSavingChat] = useState(false);
  const [chatListLoading, setChatListLoading] = useState(false);
  const [chatID, setChatId] = useState(null);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);

  const [summarizing, setSummarizing] = useState("");

  const [snackbar, setSnackbar] = useState({
    open: false,
    msg: "",
    severity: "success",
  });


  useEffect(() => {
    setLoading(true);

    let timer = null;

    const fetchFiles = async () => {
      try {
        const token = await getToken();
        const res = await axios.get("http://localhost:5000/files", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setFiles(res.data || []);

        const hasActive = res.data.some((f) =>
          ["QUEUED", "PROCESSING"].includes(f.status),
        );

        if (hasActive && !timer) {
          timer = setInterval(fetchFiles, 4000);
        }

        // stop polling if done
        if (!hasActive && timer) {
          clearInterval(timer);
          timer = null;
        }

      } catch (error) {
        console.error("Error fetching files", error);
       setLoading(false);
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [refresh]);

  const handleDelete = async (id) => {
    setConfirmDeleteOpen(false);
    try {
      const token = await getToken();
      await axios.delete(`http://localhost:5000/files/${id}/deletefile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFiles((prev) => prev.filter((f) => f._id !== id));
      setSnackbar({ open: true, msg: "File deleted", severity: "success" });
    } catch (err) {
      console.error("Error deleting file:", err);
      setSnackbar({ open: true, msg: "Failed to delete file", severity: "error" });
    }
  };

  const confirmDelete = (id) => {
    setFileToDelete(id);
    setConfirmDeleteOpen(true);
  };

  const openChat = async (file) => {
    setSelectedFile(file);
    setChatOpen(true);
    const fileId = file?._id;

    try {
    setChatListLoading(true);
    const token = await getToken();

    const res  = await axios.get(`http://localhost:5000/files/${fileId}/getchats`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log("Fetched chat history:", res.data.data._id)
    setChatId(res.data?.data?._id || null)
    setMessages(res.data?.data?.messages || []);
  } catch (e) {
    console.error(e);
    setSnackbar({ open: true, msg: "Failed to load chat history", severity: "error" });
  } finally {
    setChatListLoading(false);
  }
  };

  const closeChat = async () => {
  const fileId = selectedFile?._id;
  const chatMessages = [...messages];
  const savedChatId = chatID;

  // if nothing to save, just close
  if (!fileId || chatMessages.length === 0) {
    setChatOpen(false);
    setSelectedFile(null);
    setMessages([]);
    setInput("");
    return;
  }

  try {
    setSavingChat(true);
    const token = await getToken();

    if(savedChatId){
      console.log("Updating existing chat:", savedChatId)
      await axios.put(
        `http://localhost:5000/files/${savedChatId}/updatechat`,
        { messages: chatMessages },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSnackbar({ open: true, msg: "Chat Updated", severity: "success" });
    }else{
      console.log("Saving new chat for file:", fileId)
      const res = await axios.post(
      `http://localhost:5000/files/${fileId}/savechat`,
      {messages: chatMessages},
      { headers: { Authorization: `Bearer ${token}` } }
    );

    setSnackbar({ open: true, msg: "Chat saved", severity: "success" });  
  } 

  setChatOpen(false);
  setSelectedFile(null);
  setMessages([]);
  setInput("");
  setChatId(null);
}
catch (err) {
    console.error("Failed to save chat:", err?.response?.data || err);
    setSnackbar({ open: true, msg: "Failed to save chat", severity: "error" });
  } finally {
    setSavingChat(false);
  }
}
  


  const sendMessage = async () => {
    const question = input.trim();
    if (!question || !selectedFile) return;

    const userMsg = { role: "user", text: question, ts: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const token = await getToken();
      const { data } = await axios.post(
        `http://localhost:5000/files/${selectedFile._id}/chat`,
        { question },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const answerText = data?.answer ?? data?.response ?? data?.text ?? "No answer returned.";
      const assistantMsg = { role: "assistant", text: answerText, ts: new Date().toISOString() };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Error: failed to get a response.", ts: new Date().toISOString() },
      ]);
    } finally {
      setSending(false);
    }
  };

  const summarizePdf = async (file) => {
    if (!file) return;
  };

  const getFileIcon = (mimetype) => {
    if (mimetype.includes("pdf")) {
      return <PictureAsPdfIcon fontSize="small" className="fileCard__typeIcon fileCard__typeIcon--pdf" />;
    } else if (mimetype.includes("word") || mimetype.includes("officedocument")) {
      return <DescriptionIcon fontSize="small" className="fileCard__typeIcon fileCard__typeIcon--word" />;
    } else {
      return <InsertDriveFileIcon fontSize="small" className="fileCard__typeIcon" />;
    }
  };

  return (
    <Box className="main">

      <Box>

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          className="main__header"
        >
          <Typography variant="h6" className="main__title">
            My files
          </Typography>
          <Typography variant="body2" className="main__count">
            {files.length} file{files.length !== 1 ? "s" : ""}
          </Typography>
        </Stack>

        {loading ? (
          <Box className="main__grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} variant="outlined" className="main__skeletonCard">
                <CardContent>
                  <Skeleton width="60%" />
                  <Skeleton width="40%" />
                  <Box sx={{ height: 16 }} />
                  <Skeleton variant="rectangular" height={8} />
                </CardContent>
              </Card>
            ))}
          </Box>
        ) : files.length === 0 ? (
          <Box className="main__empty">
            <Avatar className="main__emptyAvatar">
              <InsertDriveFileIcon sx={{ fontSize: 40 }} />
            </Avatar>
            <Typography variant="h6" className="main__emptyTitle">
              No files yet
            </Typography>
            <Typography variant="body2" className="main__emptySub">
              Upload files from the sidebar to get started.
            </Typography>
          </Box>
        ) : (
          <Box className="main__grid">
            {files.map((file) => (
              <Card key={file._id} variant="outlined" className="fileCard">
                <Box className="fileCard__strip" />

                <CardContent className="fileCard__content">

                  {getFileIcon(file.mimetype)}

                  <Box className="fileCard__meta">
                    <Typography
                      variant="subtitle1"
                      noWrap
                      title={file.filename}
                      className="fileCard__name"
                    >
                      {file.filename}
                    </Typography>

                    <Box className="fileCard__timeRow">
                      <Typography
                        variant="caption"
                        noWrap
                        className="fileCard__caption"
                      >
                        {dayjs(file.uploadedAt).format("MMM D, YYYY")}
                      </Typography>

                      {["QUEUED", "PROCESSING"].includes(
                        (file.status || "").toUpperCase(),
                      ) ? (
                        <Box className="fileCard__status fileCard__status--loading">
                          <CircularProgress
                            size={12}
                            thickness={5}
                            className="fileCard__statusSpinner"
                          />
                          <Typography
                            variant="caption"
                            noWrap
                            className="fileCard__statusText"
                          >
                            embedding…
                          </Typography>
                        </Box>
                      ) : (file.status || "").toUpperCase() === "READY" ? (
                        <Chip
                          size="small"
                          icon={<CheckCircleIcon />}
                          label="embedded"
                          variant="outlined"
                          className="fileCard__statusChip"
                        />
                      ) : (
                        <Typography
                          variant="caption"
                          noWrap
                          className="fileCard__caption"
                        >
                          error
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </CardContent>

                <Divider className="fileCard__divider" />

                <CardActions className="fileCard__actions">
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Open in new tab" arrow>
                      <IconButton
                        size="small"
                        component="a"
                        href={file.s3Url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="fileCard__iconBtn"
                      >
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Chat about this PDF" arrow>
                      <IconButton
                        size="small"
                        onClick={() => openChat(file)}
                        className="fileCard__iconBtn"
                      >
                        <ChatBubbleOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Create summary (PDF)" arrow>
                      <IconButton
                        size="small"
                        onClick={() => summarizePdf(file)}
                        disabled={summarizing === file._id}
                        className="fileCard__iconBtn"
                      >
                        {summarizing === file._id ? (
                          <CircularProgress size={18} />
                        ) : (
                          <SummarizeIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Stack>

                  <Tooltip title="Delete file" arrow>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => confirmDelete(file._id)}
                      className="fileCard__deleteBtn"
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            ))}
          </Box>
        )}

      </Box>

      <Dialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
      >
        <DialogTitle className="main__dialogTitle">Delete file?</DialogTitle>
        <DialogContent>
          <Typography className="main__dialogText">
            Are you sure you want to delete this file? This action cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmDeleteOpen(false)}
            className="main__dialogBtn"
          >
            Cancel
          </Button>
          <Button
            color="error"
            onClick={() => fileToDelete && handleDelete(fileToDelete)}
            className="main__dialogBtn"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <ChatWindow 
        selectedFile={selectedFile}
        chatOpen={chatOpen}
        messages={messages}
        input={input}
        setInput={setInput}
        closeChat={closeChat}
        sendMessage={sendMessage}
        sending={sending}
        savingChatLoading={savingChatLoading}
        chatListLoading={chatListLoading}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        message={snackbar.msg}
      />

    </Box>
  );
};

export default MainArea;
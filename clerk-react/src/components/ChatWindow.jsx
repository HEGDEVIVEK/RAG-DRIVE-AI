import React, { useEffect, useRef } from "react";
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  IconButton,
  Stack,
  TextField,
  Button,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CircularProgress from "@mui/material/CircularProgress";

import "../scss/ChatWindow.scss"; // ✅ separate file

const ChatWindow = ({
  selectedFile,
  chatOpen,
  messages,
  input,
  setInput,
  closeChat,
  sendMessage,
  sending,
  savingChatLoading,
  chatListLoading
}) => {
  const chatScrollRef = useRef(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, chatOpen]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sending) sendMessage();
    }
  };

  return (
    <Dialog
      open={chatOpen}
      onClose={closeChat}
      aria-labelledby="chat-dialog-title"
      maxWidth={false}
      fullWidth={false}
      PaperProps={{ className: "chatPaper" }}
    >
      <DialogTitle id="chat-dialog-title" className="chatTitle">
        <Typography variant="subtitle1" noWrap>
          {selectedFile ? selectedFile.filename : ""}
        </Typography>
       
       {(savingChatLoading || chatListLoading) && (
         <Box className="chatSavingLoadingText">
          <CircularProgress size={16} thickness={5} className="chatSavingLoading" />
            <Typography variant="caption" className="chatStatusText" noWrap>
            {savingChatLoading ? "Saving chat…" : "Loading chat…"}
            </Typography>
          </Box>
        )}


        <IconButton
          aria-label="close"
          onClick={closeChat}
          className="chatClose"
          size="small"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers className="chatContent">
        <Box ref={chatScrollRef} className="chatScroll">
          <Stack spacing={1}>
            {messages.map((m, idx) => (
              <Box
                key={`${m.role}-${idx}`}
                className={`chatBubble ${m.role === "user" ? "chatBubble--user" : "chatBubble--bot"}`}
              >
                <Typography variant="body2">{m.text}</Typography>
              </Box>
            ))}
            {sending && (
              <Box className="chatBubble chatBubble--bot chatBubble--loading">
                <Box className="chatLoadingRow">
                  <CircularProgress size={16} thickness={5} />
                  <Typography variant="body2">Thinking…</Typography>
                </Box>
              </Box>
            )}
          </Stack>
        </Box>
      </DialogContent>

      <DialogActions className="chatActions">
        <TextField
          fullWidth
          size="small"
          placeholder="Ask question about this file…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          variant="contained"
          className="chatSend"
        >
          Send
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ChatWindow;
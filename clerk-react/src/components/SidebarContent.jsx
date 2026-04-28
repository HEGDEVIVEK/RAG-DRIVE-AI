import React, { useState, useRef } from "react";
import axios from "axios";
import {
  Typography,
  Button,
  Box,
  Menu,
  MenuItem,
  Paper,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Stack,
  IconButton,
  Tooltip,
} from "@mui/material";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import Uploadbars from "./Uploadbars";
import { useAuth, useUser } from "@clerk/clerk-react";
import "../scss/SidebarContent.scss";


const SidebarContent = ({ setRefresh }) => {
  const { getToken } = useAuth();
  const { user } = useUser();

  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState([]);

  const fileInputRef = useRef(null);
  const openMenu = Boolean(anchorEl);

  const handleClickNew = (event) => setAnchorEl(event.currentTarget);
  const handleCloseMenu = () => setAnchorEl(null);

  const handleUploadFile = () => {
    fileInputRef.current?.click();
    handleCloseMenu();
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setSelectedFiles(files);
  };

  const removeSelected = (idx) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
    setUploadingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleFileUpload = async () => {
    if (selectedFiles.length === 0) return;

    const initial = selectedFiles.map((file) => ({
      name: file.name,
      status: "uploading",
      progress: 0,
    }));
    setUploadingFiles(initial);

    try {
      const token = await getToken();
      console.log(token)

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fd = new FormData();
        fd.append("files", file);

        const res = await axios.post("http://localhost:5000/upload", fd, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            const percent = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;

            setUploadingFiles((prev) =>
              prev.map((p, idx) => (idx === i ? { ...p, progress: percent } : p))
            );
          },
        });

        setUploadingFiles((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, status: "success", progress: 100 } : p))
        );
      }
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadingFiles((prev) => prev.map((p) => ({ ...p, status: "error" })));
    } finally {
      setRefresh((prev) => !prev);
      setTimeout(() => {
        setUploadingFiles([]);
        setSelectedFiles([]);
      }, 2000);
    }
  };

  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Guest";
  const firstLetter = (displayName?.trim()?.charAt(0) || "G").toUpperCase();

  return (
    <Paper elevation={0} className="sidebar">
      
      {/* Header */}
      <Stack direction="row" spacing={1.5} alignItems="center" className="sidebar__header">

        <Avatar className="sidebar__avatar" aria-label="User avatar">
          {firstLetter}
        </Avatar>

        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" noWrap className="sidebar__name">
            {displayName}
          </Typography>

          <Typography variant="caption" className="sidebar__sub">
            Quick actions
          </Typography>
        </Box>

      </Stack>

      <Divider className="sidebar__divider" />

      {/* Actions */}
      <Box>
        <Tooltip title="going into mothership" arrow placement="bottom">
          <span>
            <Button
              variant="contained"
              startIcon={<CloudUploadIcon />}
              fullWidth
              onClick={handleClickNew}
              className="sidebar__newBtn"
            >
              New
            </Button>
          </span>
        </Tooltip>

        <Menu
          anchorEl={anchorEl}
          open={openMenu}
        >
          <MenuItem disabled>
            <ListItemIcon>
              <CreateNewFolderIcon fontSize="small" sx={{ color: "#5f6368" }} />
            </ListItemIcon>
            <ListItemText primary="Create folder" />
          </MenuItem>

          <MenuItem onClick={handleUploadFile}>
            <ListItemIcon>
              <InsertDriveFileIcon fontSize="small" sx={{ color: "#1a73e8" }} />
            </ListItemIcon>
            <ListItemText
              primary="Upload file"
            />
          </MenuItem>

          <MenuItem disabled>
            <ListItemText primary="Upload folder" />
          </MenuItem>
        </Menu>

        <input ref={fileInputRef} id="file-input" type="file" multiple hidden onChange={handleFileInputChange} />

        <Button
          variant="outlined"
          color="primary"
          fullWidth
          onClick={handleFileUpload}
          disabled={selectedFiles.length === 0}
          className="sidebar__uploadBtn"
          sx={{
            color: selectedFiles.length === 0 ? "#5f6368" : "#1a73e8",
            borderColor: selectedFiles.length === 0 ? "#e0e0e0" : "#1a73e8",
          }}
        >
          Upload
        </Button>
      </Box>

      <Divider className="sidebar__divider" />

      {/* Uploads list */}
      <Box className="sidebar__uploads">
        <Typography variant="subtitle2" className="sidebar__uploadsTitle">
          Uploads
        </Typography>

        {selectedFiles.length === 0 ? (
          <Typography variant="body2" className="sidebar__empty">
            No active uploads
          </Typography>
        ) : (
          <List dense className="sidebar__list">
            {selectedFiles.map((f, idx) => (
              <ListItem
                key={f.name + idx}
                className="sidebar__item"
                secondaryAction={
                  <Tooltip title="Remove from queue" arrow>
                    <IconButton
                      edge="end"
                      aria-label="remove"
                      size="small"
                      onClick={() => removeSelected(idx)}
                      className="sidebar__deleteBtn"
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemIcon className="sidebar__fileIconWrap">
                  <InsertDriveFileIcon className="sidebar__fileIcon" />
                </ListItemIcon>

                <ListItemText
                  className="sidebar__fileText"
                  primary={
                    <Typography variant="body2" noWrap title={f.name} className="sidebar__fileName">
                      {f.name}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* Status bars */}
      <Box className="sidebar__bars">
        <Uploadbars uploadingFiles={uploadingFiles} />
      </Box>

      {/* Footer */}
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" className="sidebar__footer">
        <Typography variant="caption" className="sidebar__ready">
          Ready
        </Typography>
      </Stack>
    </Paper>
  );
};

export default SidebarContent;
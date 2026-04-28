import { Box, Alert, CircularProgress, AlertTitle, Paper } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DangerousIcon from "@mui/icons-material/Dangerous";

type props = {
  uploadingFiles: {
    name: string;
    status: "uploading" | "success" | "error";
    progress?: number;
  }[];
};

const Uploadbars = ({ uploadingFiles }: props) => {
  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 1400,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      {uploadingFiles.map((file, index) => (
        <Paper key={`${file.name}-${index}`} elevation={4}>
          <Alert
            variant="outlined"
            severity={
              file.status === "success"
                ? "success"
                : file.status === "error"
                ? "error"
                : "info"
            }
            icon={
              file.status === "uploading" ? (
                <CircularProgress size={20} variant="determinate" value={file.progress} color="inherit" />
              ) : file.status === "success" ? (
                <CheckCircleIcon color="success" />
              ) : (
                <DangerousIcon color="error" />
              )
            }
          >
            <AlertTitle sx={{ textTransform: "capitalize" }}>
              {file.status}
            </AlertTitle>
            {file.name}
          </Alert>
        </Paper>
      ))}
    </Box>
  );
};

export default Uploadbars;

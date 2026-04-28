import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  Tooltip,
  IconButton,
} from "@mui/material";
import { useClerk } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

import "../scss/AppbarNav.scss";

export default function AppbarNav() {
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/", { replace: true });
    } catch (e) {
      console.error("Sign out failed", e);
    }
  };

  return (
    <AppBar position="static" color="transparent" elevation={0} className="appbar">
      <Toolbar className="appbar__toolbar">

        {/* Left: Logo + Title */}
        <Box className="appbar__left">
          <IconButton size="small" className="appbar__logoBtn">
            <AutoAwesomeIcon />
          </IconButton>

          <Typography variant="h6" className="appbar__title">
            MeshMind
          </Typography>

          <Typography variant="body2" className="appbar__pill">
            Workspace
          </Typography>
        </Box>

        {/* Right: Logout */}
        <Box>
          <Tooltip title="Sign out" arrow placement="bottom">
            <span>
              <Button onClick={handleLogout} className="appbar__logout">
                Logout
              </Button>
            </span>
          </Tooltip>
        </Box>
        
      </Toolbar>
    </AppBar>
  );
}
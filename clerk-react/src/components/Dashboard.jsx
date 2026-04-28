import React, { useState } from "react";
import { Box, CssBaseline, Paper } from "@mui/material";
import AppbarNav from "./AppbarNav";
import SidebarContent from "./SidebarContent";
import MainArea from "./MainArea";
import  "../scss/Dashboard.scss";



export default function Dashboard() {
  const [refresh, setRefresh] = useState(false);

  return (
    <Box className="page">
      <CssBaseline />

      {/* Top Navigation */}
      <Box className="navWrap">
        <Paper elevation={1} className="navCard">
          <AppbarNav />
        </Paper>
      </Box>

      {/* Body: Sidebar + Main */}
      <Box className="body">
        <Paper elevation={2} className="sidebarCard">
          <SidebarContent setRefresh={setRefresh} />
        </Paper>

        <Paper elevation={2} className="mainCard">
          <MainArea refresh={refresh} />
        </Paper>
      </Box>
    </Box>
  );
}
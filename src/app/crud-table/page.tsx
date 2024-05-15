"use client";

import React from "react";
import { DataGrid } from "@toolpad/dashboard";
import { employees } from "./data";
import { Box } from "@mui/material";

export default function Page() {
  return (
    <Box sx={{ height: 400 }}>
      <DataGrid dataProvider={employees} pageSizeOptions={[10, 25, 100]} />
    </Box>
  );
}

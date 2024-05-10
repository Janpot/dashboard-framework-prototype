"use client";

import React from "react";
import { DataGrid } from "@toolpad/dashboard";
import { employees } from "./data";

export default function Page() {
  return <DataGrid dataProvider={employees} pageSizeOptions={[10, 25, 100]} />;
}

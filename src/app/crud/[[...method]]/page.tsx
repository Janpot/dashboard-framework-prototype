"use client";

import React from "react";
import { CrudPage } from "@toolpad/dashboard";
import { employees } from "./data";

export default function Page() {
  return <CrudPage dataProvider={employees} />;
}

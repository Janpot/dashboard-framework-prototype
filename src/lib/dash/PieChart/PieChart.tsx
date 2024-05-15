"use client";

import React from "react";
import { PieChart as XPieChart } from "@mui/x-charts";
import { Box } from "@mui/material";
import { useGetMany, ResolvedDataProvider, Datum } from "../DataProvider";
import { LoadingOverlay, ErrorOverlay } from "../components";

export interface PieChartProps<R extends Datum> {
  dataProvider: ResolvedDataProvider<R>;
  dimension: string;
  label: string;
}

export function PieChart<R extends Datum>({
  dataProvider,
  dimension,
  label,
}: PieChartProps<R>) {
  const {
    data,
    loading: loading,
    error,
  } = useGetMany(dataProvider, { pagination: null, filter: {} });

  const series = React.useMemo(() => {
    const rows = data?.rows ?? [];

    const seriesData = rows.map((row) => ({
      // id: String(row._index),
      value: Number(row[dimension]),
      label: String(row[label]),
    }));
    return [{ data: seriesData }];
  }, [data, dimension, label]);

  return (
    <Box sx={{ position: "relative" }}>
      <XPieChart series={series} height={300} />
      {loading ? <LoadingOverlay /> : null}
      {error ? <ErrorOverlay error={error} /> : null}
    </Box>
  );
}

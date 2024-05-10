import * as React from "react";
import { ResolvedDataProvider, Datum, ValidProp, useGetMany } from "../data";
import { ErrorOverlay, LoadingOverlay } from "../components";
import { Box, Card, CardContent, Typography } from "@mui/material";

export type Aggregation =
  | "latest"
  | "sum"
  | "average"
  | "count"
  | "min"
  | "max";

export interface MetricProps<R extends Datum> {
  dataProvider: ResolvedDataProvider<R>;
  field: ValidProp<R>;
  aggregation?: Aggregation;
  label?: string;
}

function aggregate(rows: any[], field: string, aggregation: Aggregation) {
  const values = rows.map((row) => row[field]);
  if (aggregation === "latest") {
    return values[values.length - 1];
  }
  if (aggregation === "sum") {
    return values.reduce((acc, value) => acc + value, 0);
  }
  if (aggregation === "average") {
    return values.reduce((acc, value) => acc + value, 0) / values.length;
  }
  if (aggregation === "count") {
    return values.length;
  }
  if (aggregation === "min") {
    return Math.min(...values);
  }
  if (aggregation === "max") {
    return Math.max(...values);
  }
  throw new Error(`Unknown aggregation: ${aggregation}`);
}

const numberFormat = new Intl.NumberFormat();

export function Metric<R extends Datum>({
  label,
  dataProvider,
  field,
  aggregation = "latest",
}: MetricProps<R>) {
  const { data, loading: loading, error } = useGetMany(dataProvider);

  const fieldDef = React.useMemo(() => {
    return dataProvider.fields[field];
  }, [dataProvider.fields, field]);

  const value = React.useMemo(() => {
    const rows = data?.rows ?? [];
    return aggregate(rows, field, aggregation);
  }, [data, aggregation, field]);

  const formattedValue = React.useMemo(() => {
    const numberValue = Number(value);
    if (isNaN(numberValue)) {
      return "-";
    }
    if (fieldDef?.valueFormatter) {
      return fieldDef.valueFormatter(numberValue as any, field);
    }
    return numberFormat.format(numberValue);
  }, [field, fieldDef, value]);

  return (
    <Card>
      <CardContent>
        <Box sx={{ position: "relative" }}>
          <Typography>{label ?? fieldDef?.label ?? field}</Typography>
          <Typography variant="h6">{formattedValue}</Typography>
          {loading ? <LoadingOverlay /> : null}
          {error ? <ErrorOverlay error={error} /> : null}
        </Box>
      </CardContent>
    </Card>
  );
}

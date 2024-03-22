"use client";

import {
  DataGridPro,
  DataGridProProps,
  GridColDef,
  GridValueGetter,
} from "@mui/x-data-grid-pro";
import React from "react";
import { Box, styled } from "@mui/material";
import {
  ResolvedDataProvider,
  ResolvedField,
  Datum,
  useGetMany,
} from "../data";
import { ErrorOverlay, LoadingOverlay } from "../components";

const PlaceholderBorder = styled("div")(({ theme }) => ({
  position: "absolute",
  inset: "0 0 0 0",
  backgroundColor: theme.palette.background.paper,
  borderColor: theme.palette.divider,
  borderWidth: 1,
  borderStyle: "solid",
  borderRadius: theme.shape.borderRadius,
}));

export interface DataGridProps<R extends Datum>
  extends Pick<
    DataGridProProps<R>,
    "getRowId" | "pagination" | "autoPageSize" | "onRowClick"
  > {
  columns?: readonly GridColDef<R>[];
  dataProvider: ResolvedDataProvider<R>;
}

const dateValueGetter = (value: any) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  return new Date(value);
};

function wrapWithDateValueGetter<R extends Datum>(
  valueGetter?: GridValueGetter<R>,
): GridValueGetter<R> {
  if (!valueGetter) {
    return dateValueGetter;
  }

  return (oldValue, ...args) => {
    const newValue = valueGetter(oldValue, ...args);
    return dateValueGetter(newValue);
  };
}

function getColumnsFromFields<R extends Datum>(
  fields: { [K in keyof R & string]: Omit<ResolvedField<R, K>, "field"> },
  columnsProp?: readonly GridColDef<R>[],
): readonly GridColDef<R>[] {
  const resolvedColumns =
    columnsProp ??
    Object.entries(fields).map(([name, field]) => {
      const colDef: GridColDef<R> = {
        field: name,
        type: field.type,
        headerName: field.label,
      };
      const valueFormatter = field.valueFormatter;
      if (valueFormatter) {
        colDef.valueFormatter = valueFormatter;
      }
      return colDef;
    });

  return resolvedColumns.map((column) => {
    let valueGetter: GridValueGetter<R> | undefined = column.valueGetter;

    if (column.type === "date" || column.type === "dateTime") {
      valueGetter = wrapWithDateValueGetter(valueGetter);
    }

    return {
      ...column,
      valueGetter,
    };
  });
}

export function DataGrid<R extends Datum>({
  dataProvider,
  columns: columnsProp,
  ...props
}: DataGridProps<R>) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);
  const { data, loading, error } = useGetMany(dataProvider);

  const columns = React.useMemo(
    () => getColumnsFromFields(dataProvider.fields, columnsProp),
    [columnsProp, dataProvider.fields],
  );

  const rows = React.useMemo(() => {
    return data?.rows.map((row, index) => ({ ...row, _index: index })) ?? [];
  }, [data]);

  return (
    <Box sx={{ height: 400, position: "relative" }}>
      {mounted ? (
        <>
          <DataGridPro
            rows={rows}
            columns={columns}
            loading={loading}
            initialState={{
              columns: {
                columnVisibilityModel: {
                  id: false,
                },
              },
            }}
            {...props}
          />
          {error ? (
            <PlaceholderBorder>
              <ErrorOverlay error={error} />
            </PlaceholderBorder>
          ) : null}
        </>
      ) : (
        <PlaceholderBorder>
          <LoadingOverlay />
        </PlaceholderBorder>
      )}
    </Box>
  );
}

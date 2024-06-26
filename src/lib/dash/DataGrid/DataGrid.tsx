"use client";

import {
  DataGrid as XDataGrid,
  DataGridProps as XDataGridProps,
  GridColDef,
  GridSlotsComponent,
  GridRowId,
  GridRowModes,
  GridRowModesModel,
  GridToolbarColumnsButton,
  GridToolbarContainer,
  GridToolbarDensitySelector,
  GridToolbarExport,
  GridToolbarFilterButton,
  GridValueGetter,
  useGridApiRef,
  GridActionsCellItemProps,
  GridActionsCellItem,
  GridEventListener,
  GridPaginationModel,
} from "@mui/x-data-grid";
import React from "react";
import { Box, Button, CircularProgress, styled } from "@mui/material";
import {
  ResolvedDataProvider,
  ResolvedField,
  Datum,
  useGetMany,
  GetManyParams,
} from "../DataProvider";
import { ErrorOverlay, LoadingOverlay } from "../components";
import { useNotifications } from "../useNotifications";
import RowsLoadingOverlay from "./LoadingOverlay";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import invariant from "invariant";
import { useNonNullableContext } from "../utils";

const subscribe = () => () => {};
const getSnapshot = () => false;
const getServerSnapshot = () => true;

function useSsr() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const ACTIONS_COLUMN_FIELD = "::toolpad-internal-field::actions::";

const DRAFT_ROW_ID = "::toolpad-internal-row::draft::";

const DRAFT_ROW_MARKER = Symbol("draft-row");

function createDraftRow(): {} {
  const row = { [DRAFT_ROW_MARKER]: true };
  return row;
}

type MaybeDraftRow<R> = R & { [DRAFT_ROW_MARKER]?: true };

function isDraftRow<R>(row: MaybeDraftRow<R>): boolean {
  return !!row[DRAFT_ROW_MARKER];
}

function cleanDraftRow<R>(row: MaybeDraftRow<R>): R {
  const cleanedRow = { ...row };
  delete cleanedRow[DRAFT_ROW_MARKER];
  return cleanedRow;
}

const PlaceholderBorder = styled("div")(({ theme }) => ({
  position: "absolute",
  inset: "0 0 0 0",
  backgroundColor: theme.palette.background.paper,
  borderColor: theme.palette.divider,
  borderWidth: 1,
  borderStyle: "solid",
  borderRadius: theme.shape.borderRadius,
}));

type ProcessRowUpdate = XDataGridProps["processRowUpdate"];

export interface DataGridProps<R extends Datum>
  extends Omit<XDataGridProps<R>, "columns" | "rows"> {
  rows?: readonly R[];
  columns?: readonly GridColDef<R>[];
  dataProvider?: ResolvedDataProvider<R>;
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

interface DeleteActionProps<R extends Datum> {
  id: GridRowId;
  dataProvider: ResolvedDataProvider<R>;
}

function DeleteAction<R extends Datum>({
  id,
  dataProvider,
}: DeleteActionProps<R>) {
  const refetch = useNonNullableContext(RefetchContext);
  const [pending, setPending] = React.useState(false);

  const notifications = useNotifications();

  const handleDeleteClick = React.useCallback(async () => {
    try {
      setPending(true);
      invariant(dataProvider.deleteOne, "deleteOne not implemented");
      await dataProvider.deleteOne(id);
      notifications.enqueue("Row deleted", {
        severity: "success",
        autoHideDuration: 5000,
      });
    } catch (error) {
      notifications.enqueue("Failed to delete row", { severity: "error" });
    } finally {
      setPending(false);
      await refetch();
    }
  }, [dataProvider, id, notifications, refetch]);

  return (
    <GridActionsCellItem
      icon={
        pending ? (
          <CircularProgress size={16} />
        ) : (
          <DeleteIcon fontSize="inherit" />
        )
      }
      label={`Delete "${id}"`}
      onClick={handleDeleteClick}
    />
  );
}

interface GridState {
  editedRowId: GridRowId | null;
  isProcessingRowUpdate: boolean;
  rowModesModel: GridRowModesModel;
}

type GridAction =
  | { kind: "START_ROW_EDIT"; rowId: GridRowId }
  | { kind: "CANCEL_ROW_EDIT" }
  | { kind: "START_ROW_UPDATE" }
  | { kind: "END_ROW_UPDATE" };

function gridEditingReducer(state: GridState, action: GridAction): GridState {
  switch (action.kind) {
    case "START_ROW_EDIT":
      if (state.editedRowId !== null) {
        return state;
      }
      return {
        ...state,
        editedRowId: action.rowId,
        rowModesModel: {
          [action.rowId]: {
            mode: GridRowModes.Edit,
          },
        },
      };
    case "CANCEL_ROW_EDIT":
      return {
        ...state,
        editedRowId: null,
        rowModesModel: state.editedRowId
          ? {
              [state.editedRowId]: {
                mode: GridRowModes.View,
                ignoreModifications: true,
              },
            }
          : {},
      };
    case "START_ROW_UPDATE":
      return {
        ...state,

        isProcessingRowUpdate: true,
        rowModesModel: {},
      };
    case "END_ROW_UPDATE":
      return { ...state, editedRowId: null, isProcessingRowUpdate: false };
  }
}

export function updateColumnsWithDataProviderFields<R extends Datum>(
  dataProvider: ResolvedDataProvider<R>,
  baseColumns: readonly GridColDef<R>[],
): readonly GridColDef<R>[] {
  const fieldMap = new Map<keyof R & string, ResolvedField<R, any>>(
    Object.entries(dataProvider.fields ?? {}),
  );

  const resolvedColumns = baseColumns.map(function <K extends keyof R & string>(
    baseColDef: GridColDef<R, R[K], string>,
  ): GridColDef<R, R[K], string> {
    const dataProviderField: ResolvedField<R, K> | undefined = fieldMap.get(
      baseColDef.field,
    );
    const colDef: GridColDef<R, R[K], string> = {
      type: dataProviderField?.type,
      headerName: dataProviderField?.label,
      ...baseColDef,
    };

    const valueFormatter = dataProviderField?.valueFormatter;
    if (valueFormatter && !colDef.valueFormatter) {
      colDef.valueFormatter = (value) =>
        valueFormatter(value, colDef.field as K);
    }

    let valueGetter: GridValueGetter<R> | undefined = colDef.valueGetter;

    if (colDef.type === "date" || colDef.type === "dateTime") {
      valueGetter = wrapWithDateValueGetter(valueGetter);
    }

    return {
      ...colDef,
      valueGetter,
    };
  });

  return resolvedColumns;
}

function updateColumnsWithDataProviderEditing<R extends Datum>(
  dataProvider: ResolvedDataProvider<R>,
  baseColumns: readonly GridColDef<R>[],
  state: GridState,
  dispatch: React.Dispatch<GridAction>,
): readonly GridColDef<R>[] {
  const canEdit = !!dataProvider.updateOne;
  const canDelete = !!dataProvider.deleteOne;
  const canCreate = !!dataProvider.createOne;
  const hasEditableRows = canCreate || canEdit;
  const hasActionsColumn: boolean = canCreate || canEdit || canDelete;

  const resolvedColumns = baseColumns.map(function <K extends keyof R & string>(
    baseColDef: GridColDef<R, R[K], string>,
  ): GridColDef<R, R[K], string> {
    const colDef = { ...baseColDef };

    if (hasEditableRows && colDef.field !== "id") {
      colDef.editable = true;
    }

    return colDef;
  });

  if (hasActionsColumn) {
    resolvedColumns.push({
      field: ACTIONS_COLUMN_FIELD,
      headerName: "Actions",
      type: "actions",
      align: "center",
      resizable: false,
      pinnable: false,
      width: 100,
      getActions: (params) => {
        const actions: React.ReactElement<GridActionsCellItemProps>[] = [];

        const isEditing =
          state.editedRowId !== null || state.isProcessingRowUpdate;
        const isEditedRow = params.id === state.editedRowId;

        if (isEditedRow) {
          actions.push(
            <GridActionsCellItem
              key="save"
              icon={
                state.isProcessingRowUpdate ? (
                  <CircularProgress size={16} />
                ) : (
                  <SaveIcon />
                )
              }
              label="Save"
              disabled={state.isProcessingRowUpdate}
              onClick={() => {
                dispatch({ kind: "START_ROW_UPDATE" });
              }}
            />,
            <GridActionsCellItem
              key="cancel"
              icon={<CloseIcon />}
              label="Cancel"
              disabled={state.isProcessingRowUpdate}
              onClick={() => {
                dispatch({ kind: "CANCEL_ROW_EDIT" });
              }}
            />,
          );
        } else {
          if (canEdit) {
            actions.push(
              <GridActionsCellItem
                key="update"
                icon={<EditIcon />}
                label="Edit"
                disabled={isEditing}
                onClick={() => {
                  dispatch({ kind: "START_ROW_EDIT", rowId: params.id });
                }}
              />,
            );
          }
          if (canDelete) {
            actions.push(
              <DeleteAction
                key="delete"
                id={params.id}
                dataProvider={dataProvider}
              />,
            );
          }
        }
        return actions;
      },
    });
  }

  return resolvedColumns;
}

interface ToolbarCreateButtonContext {
  slotsProp?: Partial<GridSlotsComponent>;
  onClick: () => void;
  disabled: boolean;
}

const ToolbarCreateButtonContext =
  React.createContext<ToolbarCreateButtonContext | null>(null);

const RefetchContext = React.createContext<(() => void) | null>(null);

function ToolbarGridCreateButton() {
  const { slotsProp, onClick, disabled } = useNonNullableContext(
    ToolbarCreateButtonContext,
  );
  const ButtonComponent = slotsProp?.baseButton ?? Button;
  return (
    <ButtonComponent
      color="primary"
      startIcon={<AddIcon />}
      onClick={onClick}
      disabled={disabled}
    >
      Add record
    </ButtonComponent>
  );
}

function ToolbarGridToolbar() {
  return (
    <GridToolbarContainer>
      <ToolbarGridCreateButton />
      <GridToolbarColumnsButton />
      <GridToolbarFilterButton />
      <GridToolbarDensitySelector />
      <GridToolbarExport />
    </GridToolbarContainer>
  );
}

function usePatchedRowModesModel(
  rowModesModel: GridRowModesModel,
): GridRowModesModel {
  const prevRowModesModel = React.useRef(rowModesModel);
  React.useEffect(() => {
    prevRowModesModel.current = rowModesModel;
  }, [rowModesModel]);

  return React.useMemo(() => {
    if (rowModesModel === prevRowModesModel.current) {
      return rowModesModel;
    }
    const base = Object.fromEntries(
      Object.keys(prevRowModesModel.current).map((rowId) => [
        rowId,
        { mode: GridRowModes.View },
      ]),
    );
    return { ...base, ...rowModesModel };
  }, [rowModesModel]);
}

function diffRows<R extends Record<PropertyKey, unknown>>(
  original: R,
  changed: R,
): Partial<R> {
  const keys = new Set([...Object.keys(original), ...Object.keys(changed)]);
  const diff: Partial<R> = {};
  for (const key of keys) {
    const originalValue = original[key];
    const changedValue = changed[key];
    if (Object.is(originalValue, changedValue)) {
      continue;
    }
    if (
      originalValue instanceof Date &&
      changedValue instanceof Date &&
      originalValue.getTime() === changedValue.getTime()
    ) {
      continue;
    }
    (diff as any)[key] = changed[key];
  }
  return diff;
}

export function DataGrid<R extends Datum>(propsIn: DataGridProps<R>) {
  const {
    dataProvider,
    columns: columnsProp,
    processRowUpdate: processRowUpdateProp,
    slots: slotsProp,
    apiRef: apiRefProp,
    initialState: initialStateProp,
    autosizeOptions: autosizeOptionsProp,
    getRowId: getRowIdProp,
    rowModesModel: rowModesModelProp,
    ...props
  } = propsIn;

  const gridApiRefOwn = useGridApiRef();
  const apiRef = apiRefProp ?? gridApiRefOwn;
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const [gridPaginationModel, setGridPaginationModel] =
    React.useState<GridPaginationModel>({
      pageSize: 10,
      page: 0,
    });

  const [editingState, dispatchEditingAction] = React.useReducer(
    gridEditingReducer,
    {
      editedRowId: null,
      isProcessingRowUpdate: false,
      rowModesModel: {},
    },
  );

  const handleCreateRowRequest = React.useCallback(() => {
    dispatchEditingAction({ kind: "START_ROW_EDIT", rowId: DRAFT_ROW_ID });
  }, []);

  const notifications = useNotifications();

  const useGetManyParams = React.useMemo<GetManyParams<R>>(
    () => ({
      pagination:
        props.paginationMode === "server"
          ? {
              start: gridPaginationModel.page * gridPaginationModel.pageSize,
              pageSize: gridPaginationModel.pageSize,
            }
          : null,
      filter: {},
    }),
    [
      gridPaginationModel.page,
      gridPaginationModel.pageSize,
      props.paginationMode,
    ],
  );

  const {
    data,
    loading: loading,
    error,
    refetch,
  } = useGetMany(dataProvider ?? null, useGetManyParams);

  const rows = React.useMemo(() => {
    const renderedRows = data?.rows ?? [];
    if (editingState.editedRowId === DRAFT_ROW_ID) {
      return [createDraftRow(), ...renderedRows];
    }
    return renderedRows;
  }, [data?.rows, editingState.editedRowId]);

  const processRowUpdate = React.useMemo<ProcessRowUpdate>(() => {
    if (processRowUpdateProp) {
      return processRowUpdateProp;
    }
    const updateOne = dataProvider?.updateOne;
    const createOne = dataProvider?.createOne;
    if (!(updateOne || createOne)) {
      return undefined;
    }
    return async (updatedRow: R, originalRow: R): Promise<R> => {
      try {
        let result: R;
        if (isDraftRow(updatedRow)) {
          invariant(createOne, "createOne not implemented");

          const rowInit = cleanDraftRow(updatedRow);

          try {
            result = await createOne(rowInit);
          } catch (error) {
            notifications.enqueue("Failed to create row", {
              severity: "error",
            });
            return { ...originalRow, _action: "delete" };
          }

          const key = notifications.enqueue("Row created", {
            severity: "success",
            actionText: "Show",
            autoHideDuration: 5000,
            onAction: () => {
              apiRef.current.setFilterModel({
                items: [
                  { field: "id", operator: "equals", value: String(result.id) },
                ],
              });
              notifications.close(key);
            },
          });
        } else {
          invariant(updateOne, "updateOne not implemented");

          const changedValues = diffRows(originalRow, updatedRow);
          if (Object.keys(changedValues).length <= 0) {
            return originalRow;
          }

          try {
            result = await updateOne(updatedRow.id, changedValues);
          } catch (error) {
            notifications.enqueue("Failed to update row", {
              severity: "error",
            });
            return originalRow;
          }

          const key = notifications.enqueue("Row updated", {
            severity: "success",
            autoHideDuration: 5000,
            actionText: "Show",
            onAction: () => {
              apiRef.current.setFilterModel({
                items: [
                  { field: "id", operator: "equals", value: String(result.id) },
                ],
              });
              notifications.close(key);
            },
          });
        }

        return result;
      } finally {
        dispatchEditingAction({ kind: "END_ROW_UPDATE" });
        refetch();
      }
    };
  }, [
    apiRef,
    dataProvider?.createOne,
    dataProvider?.updateOne,
    notifications,
    processRowUpdateProp,
    refetch,
  ]);

  const slots = React.useMemo<Partial<GridSlotsComponent>>(
    () => ({
      loadingOverlay: RowsLoadingOverlay,
      toolbar: ToolbarGridToolbar,
      ...slotsProp,
    }),
    [slotsProp],
  );

  const createButtonContext = React.useMemo(() => {
    return {
      slotsProp,
      onClick: () => {
        handleCreateRowRequest();
      },
      disabled: !!editingState.editedRowId || loading,
    };
  }, [editingState.editedRowId, handleCreateRowRequest, loading, slotsProp]);

  const getRowId = React.useCallback(
    (row: R) => {
      if (isDraftRow(row)) {
        return DRAFT_ROW_ID;
      }
      if (getRowIdProp) {
        return getRowIdProp(row);
      }
      return row.id;
    },
    [getRowIdProp],
  );

  // Remove when https://github.com/mui/mui-x/issues/11423 is fixed
  const rowModesModelPatched = usePatchedRowModesModel(
    editingState.rowModesModel ?? {},
  );

  const handleRowEditStart = React.useCallback<
    GridEventListener<"rowEditStart">
  >((params) => {
    if (params.reason === "cellDoubleClick") {
      dispatchEditingAction({ kind: "START_ROW_EDIT", rowId: params.id });
    }
  }, []);

  const columns = React.useMemo(() => {
    if (!dataProvider) {
      return columnsProp ?? [];
    }

    let gridColumns: readonly GridColDef<R>[] =
      columnsProp ??
      Object.keys(dataProvider.fields).map((field) => ({ field }));

    gridColumns = updateColumnsWithDataProviderFields(
      dataProvider,
      gridColumns,
    );

    gridColumns = updateColumnsWithDataProviderEditing(
      dataProvider,
      gridColumns,
      editingState,
      dispatchEditingAction,
    );

    return gridColumns;
  }, [columnsProp, dataProvider, editingState]);

  const isSsr = useSsr();

  return (
    <RefetchContext.Provider value={refetch}>
      <ToolbarCreateButtonContext.Provider value={createButtonContext}>
        <Box
          sx={{
            height: props.autoHeight ? undefined : "100%",
            position: "relative",
          }}
        >
          <XDataGrid
            pagination
            apiRef={apiRef}
            rows={rows}
            columns={columns}
            loading={loading}
            processRowUpdate={processRowUpdate}
            slots={slots}
            rowModesModel={rowModesModelPatched}
            onRowEditStart={handleRowEditStart}
            getRowId={getRowId}
            {...(props.paginationMode === "server"
              ? {
                  gridPaginationModel,
                  onPaginationModelChange: setGridPaginationModel,
                  rowCount: data?.totalCount ?? -1,
                }
              : {})}
            {...props}
            // TODO: How can we make this optional?
            editMode="row"
          />

          {isSsr ? (
            // At last show something during SSR https://github.com/mui/mui-x/issues/7599
            <PlaceholderBorder>
              <LoadingOverlay />
            </PlaceholderBorder>
          ) : null}

          {error ? (
            <PlaceholderBorder>
              <ErrorOverlay error={error} />
            </PlaceholderBorder>
          ) : null}
        </Box>
      </ToolbarCreateButtonContext.Provider>
    </RefetchContext.Provider>
  );
}

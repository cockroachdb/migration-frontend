import { createSlice, createEntityAdapter, PayloadAction, EntityState, nanoid } from "@reduxjs/toolkit";
import type { RootState } from "../../app/store";
import type { Import, ImportMetadata, ImportStatement } from "../../common/import";

export type Statement = ImportStatement & { id: string, importId: string, deleted: boolean };

type ImportEntry = 
  Pick<Import, "id" | "unix_nano"> &
  Pick<ImportMetadata, "status" | "message" | "database"> &
  { statements: EntityState<Statement> };

const importsAdapter = createEntityAdapter<ImportEntry>({
  // ensure import batches are sorted by timestamp first, then by ID
  sortComparer: (a, b) => {
    if (a.unix_nano !== b.unix_nano) {
      return a.unix_nano - b.unix_nano;
    } else {
      return a.id.localeCompare(b.id);
    }
  },
});

const statementsAdapter = createEntityAdapter<Statement>();

export const importsSlice = createSlice({
  name: "migration/imports",
  initialState: importsAdapter.getInitialState(),
  reducers: {
    importAdded(state, action: PayloadAction<Import>) {
      const payload = action.payload;
      const importId = payload.id;

      const statementsWithIds: Statement[] = payload.import_metadata.statements.map(stmt => ({
        id: nanoid(),
        importId: importId,
        deleted: false,
        ...stmt,
      }));
      const initialStatements = statementsAdapter.getInitialState();
      const statementsContainer = statementsAdapter.setAll(initialStatements, statementsWithIds);

      const theImport: ImportEntry = {
        id: importId,
        unix_nano: payload.unix_nano,
        status: payload.import_metadata.status,
        message: payload.import_metadata.message,
        database: payload.import_metadata.database,
        statements: statementsContainer,
      };
      importsAdapter.addOne(state, theImport);
    },
    toggleSoftDeletion(state, action: PayloadAction<Statement[]>) {
      const payload = action.payload;
      if (payload.length === 0) {
        console.warn("Attempted to mark 0 statements as deleted.");
        return;
      }
      const theImport = state.entities[payload[0].importId];
      if (!theImport) {
        return;
      }

      const modifiedStatements = payload.map(stmt => ({
        ...stmt,
        deleted: !stmt.deleted,
      }));

      statementsAdapter.setMany(theImport.statements, modifiedStatements);
    },
    insertStatement(state, action: PayloadAction<{ importId: string, index: number, statement?: string}>) {
      const { importId, index } = action.payload;
      const cockroachStatement = action.payload.statement ?? "";

      const theImport = state.entities[importId];
      if (!theImport) {
        return;
      }

      const statement: Statement = {
        importId: importId,
        id: nanoid(),
        original: "-- newly added statement",
        cockroach: cockroachStatement,
        deleted: false,
        issues: [],
      };
      const nextState = statementsAdapter.addOne(theImport.statements, statement);
      nextState.ids = [
        ...nextState.ids.slice(0, index),
        statement.id,
        ...nextState.ids.slice(index, nextState.ids.length - 1),
      ];
    },
    clearStatementIssuesByType(state, action: PayloadAction<{ statement: Statement, issueType: string }>) {
      const { statement, issueType } = action.payload;
      const theImport = state.entities[statement.importId];
      if (!theImport) {
        return;
      }

      const modifiedStatement = {
        ...statement,
        issues: statement.issues.filter(issue => issue.type !== issueType),
      };
      statementsAdapter.setOne(theImport.statements, modifiedStatement);
    },
  },
});

export const importsSelectors = importsAdapter.getSelectors<RootState>(
  (state) => state.imports
);

export const getSelectorsForImportId = (state: RootState, importId: string) => {
  let maybeImport = importsSelectors.selectById(state, importId);
  if (maybeImport) {
    return statementsAdapter.getSelectors((_state: RootState) => maybeImport!.statements);
  }
};

export default importsSlice.reducer;

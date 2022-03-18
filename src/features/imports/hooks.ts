import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { importsSlice, Statement } from "./importsSlice";

type AddUserOptions = {
  importId: string,
  index: number,
  username: string,
};

export function useAddUser() {
  const dispatch = useDispatch();

  return useCallback((username: string, index: number, importId: string, statement?: Statement, ) => {
    dispatch(
      importsSlice.actions.insertStatement({
        importId: importId,
        index: index,
        statement: `CREATE USER IF NOT EXISTS "${username}"`,
      }),
    );

    dispatch(
      importsSlice.actions.insertStatement({
        importId: importId,
        // Because we're still in the same callback, props.idx hasn't yet updated after adding the "CREATE USER"
        // statement. Insert the "GRANT" statement below the "CREATE USER" statement, which now has the same ID as
        // 'props.idx'.
        index: index + 1,
        statement: `GRANT admin TO "${username}"`,
      }),
    );

    if (statement) {
      dispatch(
        importsSlice.actions.clearStatementIssuesByType({
          statement: statement,
          issueType: "missing_user"
        })
      );
    }
  }, [ dispatch ]);
}

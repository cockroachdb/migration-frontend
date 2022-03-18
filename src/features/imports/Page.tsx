import { useEffect, useState, createRef } from "react";
import classnames from "classnames/bind";
import axios from "axios";
import { saveAs } from 'file-saver';
import { Col, Row, Dropdown, ButtonGroup, DropdownButton, Button, Spinner } from "react-bootstrap";
import { Heading, Text, FuzzyTime } from "@cockroachlabs/ui-components";

import { TitleBar, Container, Hr } from "../../app/components";
import { Statement } from "./components/Statement";
import { StatementsSummary } from "./components/StatementsSummary";
import { FindAndReplaceDialog } from "../modals/FindAndReplaceDialog";
import { SQLExecDialog } from "../modals/SQLExecDialog";
import { ExportDialog } from "../modals/ExportDialog";

import type { Import, ImportIssue, ImportStatement } from "../../common/import";
import type { FindAndReplaceArgs } from "../modals/FindAndReplaceDialog";
import { modalSlice, getVisibleModal, isFindReplaceModal, isExportModal, isSqlModal, getRawSqlTextToExecute} from "../modals/modalSlice";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { useAddUser } from "./hooks";

import { importsSlice, getSelectorsForImportId, importsSelectors, Statement as StatementType } from "./importsSlice";

import styles from "./Page.module.scss";

interface ImportPageState {
  data: Import;
  loaded: boolean;

  activeStatement: number;
  statementRefs: React.RefObject<HTMLTextAreaElement>[];
}

interface ImportPageProps {
  id: string;
}

const cx = classnames.bind(styles);

export const ImportPage = (props: ImportPageProps) => {
  const [state, setState] = useState<ImportPageState>({
    loaded: false,
    data: {
      id: props.id,
      unix_nano: 0,
      import_metadata: {
        statements: [],
        status: "",
        message: "",
        database: "",
      },
    },
    activeStatement: -1,
    statementRefs: [],
  });

  const dispatch = useAppDispatch();
  const visibleModal = useAppSelector(getVisibleModal);
  const rawSqlCommand = useAppSelector(getRawSqlTextToExecute);
  const addUser = useAddUser();

  const importId = state.data.id;
  const currentImport = useAppSelector((state) => importsSelectors.selectById(state, importId));
  const selectors = useAppSelector((state) => getSelectorsForImportId(state, importId));
  const statements = useAppSelector((state) => selectors?.selectAll(state)) || [];

  const supplyRefs = (data: ImportPageState) => {
    const refs: React.RefObject<HTMLTextAreaElement>[] = [];
    data.data.import_metadata.statements.forEach((statement) => {
      refs.push(createRef());
    })
    data.statementRefs = refs;
    data.activeStatement = -1;
    return data;
  }

  const refresh = () => {
    setState({...state, loaded: false});
    axios.get<Import>("http://" + window.location.hostname + ":5050/get", { params: { 'id': props.id } }).then(
      response => {
        dispatch(importsSlice.actions.importAdded(response.data));
        setState(supplyRefs({...state, loaded: true, data: response.data}));
      }
    )
  }

  useEffect(() => {
    refresh();
  }, [props.id])

  const undoAll = () => refresh();

  const handleSubmit = () => {
    setState({...state, loaded: false});
    axios.post<Import>(
      "http://" + window.location.hostname + ":5050/put",
      state.data,
    ).then(
      response => {
        setState(supplyRefs({...state, loaded: true, data: response.data}));
      }
    )
  };

  const handleTextAreaChangeForIdx = (idx: number, event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newState = state.data;
    newState.import_metadata.statements[idx].cockroach = event.target.value;
    setState({...state, data: newState});
  }

  const handleTextAreaChange = (idx: number) => (event: React.ChangeEvent<HTMLTextAreaElement>) => handleTextAreaChangeForIdx(idx, event);

  const handleFixSequence = (statementIdx: number, issueIdentifier: string) => {
    axios.post<ImportStatement>(
      "http://" + window.location.hostname + ":5050/fix_sequence",
      {
        statement: state.data.import_metadata.statements[statementIdx],
        id: issueIdentifier,
      },
    ).then(
      response => {
        const newState = state.data;
        newState.import_metadata.statements[statementIdx] = response.data;
        setState({...supplyRefs({...state, data: newState}), activeStatement: statementIdx});
      }
    ).catch(
      error => alert(`Error: ${error}`)
    );
  }

  const deleteAllUnimplemented = () => {
    alert(`${deleteAllUnimplementedInternal()} statements deleted!`);
  }

  const deleteAllUnimplementedInternal = () => {
    const toDelete = statements.filter(stmt => stmt.issues && stmt.issues.some(issue => issue.type === "unimplemented"))
    dispatch(importsSlice.actions.toggleSoftDeletion(toDelete));
    return toDelete.length;
  }


  const fixAllSequences = () => {
    alert(`${fixAllSequencesInternal()} sequences affected!`);
  }

  const fixAllSequencesInternal = () => {
    // This is bad but w/e.
    const elems: {
      statementIdx: number;
      id: string;
    }[] = [];

    state.data.import_metadata.statements.forEach((statement, statementIdx) => {
      if (statement.issues != null) {
        statement.issues.forEach((issue) => {
          if (issue.type === 'sequence') {
            elems.push({statementIdx: statementIdx, id: issue.id});
          }
        })
      }
    })
    elems.forEach((elem) => handleFixSequence(elem.statementIdx, elem.id));
    return elems.length;
  }

  const handleAddAllUsers = () => {
    const addedUsers = handleAddAllUsersInternal();
    alert(`${addedUsers} ${addedUsers === 1 ? "user" : "users"} added (see top of statements list)`);
  };

  const handleAddAllUsersInternal = useCallback(() => {
    type StatementIssuePair = { stmt: StatementType, issue: ImportIssue };
    const statementsWithMissingUsers = statements
      .map((stmt) => ({ stmt, issue: stmt.issues?.find(issue => issue.type === "missing_user")}) )
      .filter(({ issue }) => !!issue) as StatementIssuePair[];

    // get unique set of users to add
    let usernamesToAdd = new Set(statementsWithMissingUsers.map(({ issue }) => issue.id));

    // push them onto the array of statements, reversing them first so they appear in the correct order
    Array.from(usernamesToAdd).reverse().forEach((username) => addUser(username, 0 /* index */, importId));

    // now clean the statements with missing users, since there's a potentially 1:many relationship between missing
    // users and statements
    statementsWithMissingUsers.forEach(({ stmt }) => dispatch(
      importsSlice.actions.clearStatementIssuesByType({
        statement: stmt,
        issueType: "missing_user",
      })
    ));

    return usernamesToAdd.size;
  }, [ addUser, statements, importId ]);

  const fixAll = () => {
    var text = '';
    text += `${fixAllSequencesInternal()} sequences converted to UUID\n`;
    text += `${deleteAllUnimplementedInternal()} unimplemented statements deleted\n`;
    text += `${handleAddAllUsersInternal()} users added\n`;
    alert(text);
  }

  const setShowExport = (showExport: boolean) => {
    if (showExport) {
      dispatch(modalSlice.actions.showExport());
    } else {
      dispatch(modalSlice.actions.hideAll());
    }
  }

  const setShowSQLExec = (showSQLExec: boolean, text?: string) => {
    if (showSQLExec) {
      dispatch(modalSlice.actions.showRawSql(text ?? ""));
    } else {
      dispatch(modalSlice.actions.hideAll());
    }
  }

  const handleSave = (exportText: string, fileName: string) => {
    return () => {
      saveAs(new File([exportText], fileName, {type: "text/plain;charset=utf-8"}));
    };
  }

  const setActiveStatement = (idx: number) => {
    setState({...state, activeStatement: idx});
  }

  const handleNextStatementWithIssue = () => {
    for (let i = 0; i < state.data.import_metadata.statements.length; i++) {
      const idx = (state.activeStatement + i + 1) % state.data.import_metadata.statements.length;
      const stmt = state.data.import_metadata.statements[idx];
      if (stmt.issues != null && stmt.issues.length > 0) {
        const ref = state.statementRefs[idx];
        if (ref.current != null) {
          ref.current.scrollIntoView({behavior: "smooth", block: "center", inline: "nearest"});
          ref.current.focus();
        } else {
          alert("no ref found...");
        }
        return;
      }
    }
    alert('no issues found!');
  }

  const exportText = state.data.import_metadata.statements != null ? state.data.import_metadata.statements.map((statement) => {
    const pg = statement.original.split("\n").map(x => `-- ${x}`).join("\n")
    var crdb = statement.cockroach;
    crdb.trim();
    if (crdb.length > 0 && crdb.charAt(crdb.length - 1) !== ';') {
      crdb += ";";
    }
    return '-- postgres:\n' + pg + '\n' + crdb + '\n';
  }).join('\n') : '';

  const setFindAndReplace = (visible: boolean) => {
    if (visible) {
      dispatch(modalSlice.actions.showFindReplace());
    } else {
      dispatch(modalSlice.actions.hideAll());
    }
  }

  const findAndReplace = (args: FindAndReplaceArgs) => {
    if (args.find !== '') {
      var re : (RegExp | null) = null;
      try {
        re = new RegExp(args.find);
      } catch {
        return;
      }
      const newState = state.data;
      state.data.import_metadata.statements.forEach((statement, idx) => {
        if (args.isRegex) {
          if (re == null) {
            alert("invalid regexp");
            return;
          }
          state.data.import_metadata.statements[idx].cockroach =
            state.data.import_metadata.statements[idx].cockroach.replace(re, args.replace);
        } else {
          state.data.import_metadata.statements[idx].cockroach =
            state.data.import_metadata.statements[idx].cockroach.replace(args.find, args.replace);
        }
      });
      setState({...supplyRefs({...state, data: newState}), activeStatement: state.activeStatement});
    }
    setFindAndReplace(false);
  };

  const handleSelectAction = (key: string | null) => {
    if (key == null) {
      return;
    }
    switch (key) {
    case "undoAll":
      undoAll();
      break;
    case "showSQLExec":
      setShowExport(true);
      break;
    case "fixAll":
      fixAll();
      break;
    case "deleteAllUnimplemented":
      deleteAllUnimplemented();
      break;
    case "fixAllSequences":
      fixAllSequences();
      break;
    case "findAndReplace":
      setFindAndReplace(true);
      break;
    case "handleAddAllUsers":
      handleAddAllUsers();
      break;
    default:
      alert("unknown action: " + key)
    }
  }

  return (
    <>
      <TitleBar />
      <Container>
        <section className={cx("import-header")}>
          <Heading type="h3">
            {!state.loaded ? 'Loading database migration....' : `Results for ${state.data.id}`}
          </Heading>

        {state.loaded ?
          (<Text type="body">
            Last imported <FuzzyTime className={cx("import-fuzzy-time")} timestamp={new Date(state.data.unix_nano / 1000000)} />
          </Text>)
           : null
        }
        </section>

        <Hr />

        {state.loaded ?
          <>
            <StatementsSummary statements={statements} />
          </>
          : ''
        }
      </Container>

      <Container>
        {state.loaded ?
          <>
            <ExportDialog
              show={isExportModal(visibleModal)}
              exportText={exportText}
              handleSave={handleSave(exportText, state.data.id + '_export.sql')}/>
            <FindAndReplaceDialog
              show={isFindReplaceModal(visibleModal)}
              findAndReplace={findAndReplace}/>
            <SQLExecDialog
              show={isSqlModal(visibleModal)}
              text={rawSqlCommand}
              database={state.data.import_metadata.database}/>
          </>
          : ''}
        <form className="p-2">
          <Row className="m-2 p-2">
            <Col xs={6}><strong>PostgreSQL statement</strong></Col>
            <Col xs={6}><strong>CockroachDB statement</strong></Col>
          </Row>
          {state.loaded && currentImport ?
            statements.map((statement, idx) => (
              <Statement
                key={statement.id}
                statement={statement}
                database={currentImport.database}
                idx={idx}
                ref={state.statementRefs[idx]}
                callbacks={{
                  handleTextAreaChange: handleTextAreaChange(idx),
                  handleFixSequence: handleFixSequence,
                  setActiveStatement: () => setActiveStatement(idx),
                }}
              />
            )) : (
              <Row className="justify-content-md-center">
                <Spinner animation="border" role="status">
                  <span className="visually-hidden">Loading...</span>
                </Spinner>
              </Row>
            )
          }
          </form>
      </Container>

      <footer className="fixed-bottom sticky-footer">
        <section className="m-2" style={{textAlign: 'center'}}>
            {state.loaded ?
              <ButtonGroup>
                <Button variant="primary" onClick={handleSubmit}>Save and Reimport</Button>
                <DropdownButton
                  drop={'up'}
                  as={ButtonGroup}
                  variant="info"
                  title={`Actions`}
                  onSelect={handleSelectAction}
                >
                  <Dropdown.Item eventKey="undoAll">Revert to last import attempt</Dropdown.Item>
                  <Dropdown.Item eventKey="showSQLExec">Show current dump</Dropdown.Item>

                  <Dropdown.Divider />

                  <Dropdown.Header>Editors</Dropdown.Header>
                  <Dropdown.Item eventKey="findAndReplace">Find and Replace</Dropdown.Item>

                  <Dropdown.Divider />

                  <Dropdown.Header>Automagic fixers</Dropdown.Header>
                  <Dropdown.Item eventKey="fixAll">Automatically fix all issues</Dropdown.Item>
                  <Dropdown.Item eventKey="handleAddAllUsers">Add missing users</Dropdown.Item>
                  <Dropdown.Item eventKey="deleteAllUnimplemented">Delete unimplemented statements</Dropdown.Item>
                  <Dropdown.Item eventKey="fixAllSequences">Fix all sequences</Dropdown.Item>
                </DropdownButton>
                <Button variant="secondary" onClick={handleSave(exportText, state.data.id + '_export.sql')}>Export SQL File</Button>
                <Button variant="outline-secondary" onClick={() => setShowSQLExec(true)} disabled={state.data.import_metadata.database === ''}>Query Current State</Button>
                <Button variant="danger" onClick={handleNextStatementWithIssue}>Scroll to Next Issue</Button>
              </ButtonGroup>
            : <span className="visually-hidden">Loading...</span>}
        </section>
      </footer>
    </>
  );
}

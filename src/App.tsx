import React from 'react';

import Alert from 'react-bootstrap/Alert';
import Container from 'react-bootstrap/Container';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';
import './App.css';
import Moment from 'react-moment';
import { saveAs } from 'file-saver';

import { useNavigate, BrowserRouter, Route, Routes } from 'react-router-dom';

import axios from 'axios';


interface Import {
  id: string;
  unix_nano: number;
  import_metadata: ImportMetadata;
}

interface ImportMetadata {
  statements: ImportStatement[];
  status: string;
  message: string;
  database: string;
}

interface ImportStatement {
  original: string;
  cockroach: string;
  issues: ImportIssue[];
}

interface ImportIssue {
  level: string;
  text: string;
  id: string;
  type: string;
}

interface ImportAppState {
  data: Import;
  loaded: boolean;
  showExport: boolean;
  showSQLExec: boolean;
  sqlExecText: string;

  activeStatement: number;
  statementRefs: React.RefObject<HTMLTextAreaElement>[];
}

interface ImportAppProps {
  id: string;  
}

const ImportApp = (props: ImportAppProps) => {
  const [state, setState] = React.useState<ImportAppState>({
    loaded: false,
    showExport: false,
    showSQLExec: false,
    sqlExecText: '',
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

  const supplyRefs = (data: ImportAppState) => {
    const refs: React.RefObject<HTMLTextAreaElement>[] = [];
    data.data.import_metadata.statements.forEach((statement) => {
      refs.push(React.createRef());
    })
    data.statementRefs = refs;
    data.activeStatement = -1;
    return data;
  }

  const refresh = () => {
    setState({...state, loaded: false});
    axios.get<Import>("http://" + window.location.hostname + ":5050/get", { params: { 'id': props.id } }).then(
      response => {
        setState(supplyRefs({...state, loaded: true, data: response.data}));
      }
    ).catch(
      error => alert(`Error: ${error}`)
    );
  }

  React.useEffect(() => {
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
    ).catch(
      error => alert(`Error: ${error}`)
    );
  }

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

  const handleIssueDelete = (statementIdx: number, issueIdx: number) => {
    const newState = state.data;
    newState.import_metadata.statements[statementIdx].cockroach = '';
    newState.import_metadata.statements[statementIdx].issues.splice(issueIdx, 1);
    setState({...supplyRefs({...state, data: newState}), activeStatement: statementIdx});
  }

  const deleteAllUnimplemented = (event: React.MouseEvent<HTMLButtonElement>) => {  
    alert(`${deleteAllUnimplementedInternal()} statements deleted!`);
  }

  const deleteAllUnimplementedInternal = () => {
    // This is bad but w/e.
    const elems: {
      statementIdx: number;
      issueIdx: number;
    }[] = [];
    state.data.import_metadata.statements.forEach((statement, statementIdx) => {
      if (statement.issues != null) {
        statement.issues.forEach((issue, issueIdx) => {
          if (issue.type === 'unimplemented') {
            elems.push({statementIdx: statementIdx, issueIdx: issueIdx});
          }
        })
      }
    })
    elems.forEach((elem) => handleIssueDelete(elem.statementIdx, elem.issueIdx));
    return elems.length;
  }


  const fixAllSequences = (event: React.MouseEvent<HTMLButtonElement>) => {
    alert(`${fixAllSequencesInternal()} statements affected!`);
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

  const fixAll = (event: React.MouseEvent<HTMLButtonElement>) => {
    var text = '';
    text += `${fixAllSequencesInternal()} sequences converted to UUID\n`;
    text += `${deleteAllUnimplementedInternal()} unimplemented statements deleted\n`;
    alert(text);
  }

  const setShowExport = (showExport: boolean) => {
    setState({...state, showExport: showExport});
  }

  const setShowSQLExec = (showSQLExec: boolean, text?: string) => {
    setState({...state, showSQLExec: showSQLExec, sqlExecText: text != null ? text : state.sqlExecText});
  }

  const handleAddStatement = (idx: number) => {
    const newState = state.data;
    newState.import_metadata.statements.splice(idx, 0, {
      original: '-- newly added statement',
      cockroach: '',
      issues: [],
    })
    setState({...supplyRefs({...state, data: newState}), activeStatement: state.activeStatement});
  }

  const handleSave = (exportText: string, fileName: string) => {
    return (event: React.MouseEvent<HTMLButtonElement>) => {
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
    const pg = statement.original.split("\n")[0];
    pg.trim();
    var crdb = statement.cockroach;
    crdb.trim();
    if (crdb.charAt(crdb.length - 1) !== ';') {
      crdb += ";";
    }
    return '-- postgres: ' + pg + '\n' + crdb + '\n';
  }).join('\n') : '';

  return (
    <>
      <Container className="bg-light p-5">
        <h1 className="display-4 fw-bold">
          {!state.loaded ? 'Loading database migration....' : state.data.id}
        </h1>
        {state.loaded ? 
          <>
            <Alert variant={state.data.import_metadata.status}>{state.data.import_metadata.message}</Alert>
            <hr/>
            <StatementsSummary statements={state.data.import_metadata.statements} />
          </>
          : ''
        }          
        <hr/>
        {state.loaded ? <div>Last executed&nbsp;<Moment date={new Date(state.data.unix_nano / 1000000).toISOString()} fromNow /></div>: ''}
      </Container>

      <Container className="p-4" fluid>
        {state.loaded ? 
          <>
            <ExportDialog show={state.showExport} onHide={() => setShowExport(false)} exportText={exportText} handleSave={handleSave(exportText, state.data.id + '_export.sql')} />
            <SQLExecDialog show={state.showSQLExec} onHide={() => setShowSQLExec(false)} text={state.sqlExecText} database={state.data.import_metadata.database} />
          </>
          : ''}
        <form className="p-2">
          {state.loaded ?
            <>
              <Button variant="outline-secondary" onClick={fixAll}>Fix all</Button>
              <Button variant="outline-danger" onClick={deleteAllUnimplemented}>Delete all unimplemented statements</Button>
              <Button variant="outline-info" onClick={fixAllSequences}>All sequences to UUID</Button>
              <br/>
              <Button variant="outline-primary" onClick={undoAll}>Undo all</Button>              
              <Button variant="secondary" onClick={(event: React.MouseEvent<HTMLButtonElement>) => setShowExport(true)}>Raw Import</Button>
            </> : ''
          }
          <Row className="m-2 p-2">
            <Col xs={6}><strong>PostgreSQL statement</strong></Col>
            <Col xs={6}><strong>CockroachDB statement</strong></Col>
          </Row>
          {state.loaded ?
            state.data.import_metadata.statements.map((statement, idx) => (
              <Statement 
                key={'r' + idx} 
                statement={statement} 
                database={state.data.import_metadata.database}
                ref={state.statementRefs[idx]}
                idx={idx} 
                callbacks={{
                  handleIssueDelete: handleIssueDelete,
                  handleTextAreaChange: handleTextAreaChange(idx),
                  handleFixSequence: handleFixSequence,
                  handleAddStatement: handleAddStatement,
                  setShowSQLExec: setShowSQLExec,
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

      <Container className="m-2">
      </Container>

      <footer className="fixed-bottom navbar-light bg-light">
        <Container className="m-2" fluid style={{textAlign: 'center'}}>
          {state.loaded ?
            <p>
              <Button variant="primary" onClick={handleSubmit}>Reimport</Button>
              <Button variant="secondary" onClick={handleSave(exportText, state.data.id + '_export.sql')}>Save as SQL File</Button>
              <Button variant="outline-secondary" onClick={(event: React.MouseEvent<HTMLButtonElement>) => setShowSQLExec(true)} disabled={state.data.import_metadata.database === ''}>Execute SQL</Button>
              <Button variant="danger" onClick={handleNextStatementWithIssue}>Scroll to Next Issue</Button>
            </p>
          : <span className="visually-hidden">Loading...</span>}
        </Container>
      </footer>
    </>
  );
}

interface SQLExecResults {
  columns: string[];
  rows: string[][];
  error: string;
}

interface SQLExecState {
  results: SQLExecResults | null;
  text: string;
}

function SQLExecDialog(props: {show: boolean, onHide: () => void, text: string, database: string}) {
  const [st, setSt] = React.useState<SQLExecState>({
    text: props.text,
    results: null,
  });

  React.useEffect(() => {
    setSt((s) => ({...s, text: props.text}));
  }, [props.text]);

  const handleTextAreaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => 
    setSt({...st, text: event.target.value});

  const handleExecute = (event: React.MouseEvent<HTMLButtonElement>) => {
    axios.post<SQLExecResults>(
      "http://" + window.location.hostname + ":5050/sql",
      {database: props.database, sql: st.text},
    ).then(
      response => {
        setSt({...st, results: response.data});
      }
    ).catch(
      error => alert(`Error: ${error}`)
    );
  };

  return (
    <Modal show={props.show} onHide={() => {
      props.onHide();
      setSt({...st, results: null});
    }} >
      <Modal.Header closeButton>
        <Modal.Title>Execute Raw SQL</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p>This statement will execute on the temporarily created database. It will not be part of the import.</p>
        <textarea
          value={st.text}
          style={{width: '100%'}}
          onChange={handleTextAreaChange}
        />
        <br/>
        <Button variant="primary" onClick={handleExecute}>Execute</Button>
        {st.results != null ?
          <>
            <hr/>
            {st.results.error !== "" ? <p>Error: {st.results.error}</p> : st.results.columns != null ? 
            <Table striped bordered hover>
              <thead>
                <tr>
                  {st.results.columns.map((c, idx) => <th key={idx}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {st.results.rows.map((row, idx) => 
                  <tr key={idx}>
                    {row.map((c, cidx) => <td key={cidx}>{c}</td>)}
                  </tr>
                )}
              </tbody>
            </Table>
            : 'statement executed successfully'
            }
          </>
          : ''
        }
      </Modal.Body>
    </Modal>
  )
}

const ExportDialog = (props: {onHide: () => void; show: boolean, exportText: string, handleSave: (event: React.MouseEvent<HTMLButtonElement>) => void}) => {
  return (
    <Modal show={props.show} onHide={props.onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Raw Import</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Button onClick={props.handleSave}>Save</Button>
          <pre>
            {props.exportText}
          </pre>
      </Modal.Body>
    </Modal>
  )
}

interface StatementProps {
  statement: ImportStatement;
  idx: number;
  database: string;
  callbacks: {
    handleIssueDelete: (statementIdx: number, issueIdx: number) => void;
    handleFixSequence: (statementIdx: number, issueIdentifier: string) => void;
    handleTextAreaChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
    handleAddStatement: (idx: number) => void;
    setShowSQLExec: (showSQLExec: boolean, text?: string) => void;
    setActiveStatement: () => void;
  }
}

const Statement = React.forwardRef<HTMLTextAreaElement, StatementProps>((props, ref) => {
  const statement = props.statement;

  const colorForIssue = (issues: ImportIssue[]) => {
    if (issues == null || issues.length === 0) {
      return null;
    }
    var color = 'info';
    issues.forEach((value) => {
      switch (value.level) {
        case "info":
          break;
        default:
          color = 'danger';
      }
    });
    return color;
  }

  const onDelete = (idx: number) =>
    (event: React.MouseEvent<HTMLButtonElement>) => props.callbacks.handleIssueDelete(props.idx, idx);
  const onFixSequence = (statementIdx: number, issueIdentifier: string) => 
    (event: React.MouseEvent<HTMLButtonElement>) => props.callbacks.handleFixSequence(statementIdx, issueIdentifier)


  const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;
  const hyperlinkText = (inputText: string) => 
    inputText.split(" ")
    .map((part, idx) =>
      <React.Fragment key={idx}>
        {URL_REGEX.test(part) ? <>
              <a href={part} target="_blank" rel="noreferrer">{part}</a>&nbsp;
          </> : (part + " ")
        }
      </React.Fragment>
    );

  return (
    <Row className={"m-2 p-2 border " + (colorForIssue(statement.issues) != null ? 'border-' + colorForIssue(statement.issues): '')}>
      <Col xs={6}>
        <pre>{statement.original}</pre>
      </Col>
      <Col xs={6}>
        
        <ul>
          {statement.issues != null && statement.issues.length > 0 ? statement.issues.map((issue, idx) => (
            <li key={'li' + idx} className={"issue-level-" + issue.level}>
              {hyperlinkText(issue.text)}
              {issue.type === 'unimplemented' ? (
                <Button variant="outline-danger" onClick={onDelete(idx)}>Delete Statement</Button>
              ) : ''}
              {issue.type === "sequence" ? (
                <Button variant="outline-info" onClick={onFixSequence(props.idx, issue.id)}>Make UUID</Button>
              ): ''}
            </li>
          )): ''}
        </ul>
        <textarea
          className="form-control"
          id={'ta' + props.idx}
          value={statement.cockroach}
          ref={ref}
          placeholder={statement.cockroach.trim() === '' ? '-- statement ignored': ''}
          onChange={props.callbacks.handleTextAreaChange}
          onFocus={() => props.callbacks.setActiveStatement()}
          rows={statement.cockroach.split('\n').length + 1}
        />

        <p>
          <Button variant="outline-primary" onClick={(event: React.MouseEvent<HTMLButtonElement>) => props.callbacks.handleAddStatement(props.idx)}>Insert Statement Before</Button>
          <Button variant="outline-primary" onClick={(event: React.MouseEvent<HTMLButtonElement>) => props.callbacks.handleAddStatement(props.idx + 1)}>Insert Statement After</Button>
          {props.database !== "" ? <Button variant="outline-primary" onClick={(event: React.MouseEvent<HTMLButtonElement>) => props.callbacks.setShowSQLExec(true, statement.cockroach)}>Execute</Button> : ''}
        </p>
      </Col>
    </Row>
  )
})

function StatementsSummary(props: {statements: ImportStatement[]}) {
  var numStatements = 0;
  var numDanger = 0;
  var numInfo = 0;

  props.statements.forEach((statement) => {
    numStatements++;
    if (statement.issues != null) {
      statement.issues.forEach((issue) => {
        switch (issue.level) {
          case "info":
            numInfo++;
            break;
          default:
            numDanger++;
        }
      })
    }
  })

  return (
    <ul>
      <li>{numStatements} statements found.</li>
      <li style={numDanger > 0 ? {color: 'red'}: {}}>{numDanger} fixes required.</li>
      <li style={numInfo > 0 ? {color: 'blue'} : {}}>{numInfo} optional audits.</li>
    </ul>
  )
}

function Home(props: {setID: (s: string) => void}) {
  const [uploadedFileName, setUploadedFileName] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleUpload = () => {
    inputRef.current?.click();
  };
  const handleDisplayFileDetails = () => {
    inputRef.current?.files &&
      setUploadedFileName(inputRef.current.files[0].name);
  };  
  let navigate = useNavigate();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inputRef.current == null || inputRef.current.files == null || uploadedFileName == null) {
      console.error(`no input file`);
      return;
    }
    const formData = new FormData();
    formData.append("file", inputRef.current.files[0]);
    formData.append("id", uploadedFileName);
    axios.post<Import>(
      "http://" + window.location.hostname + ":5050/upload",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    ).then(
      response => {
        console.log(response.data.id);
        props.setID(response.data.id);
        navigate("/import"); // ?id=" + response.data.id);
      }
    ).catch(
      error => console.error(`Error: ${error}`)
    );
  }

  return (
    <>
      <Container className="bg-light p-5">
        <h1 className="display-4 fw-bold">
          CockroachDB Importer
        </h1>
        <hr/>

        <form onSubmit={handleSubmit} className="p-2">
          <p>Upload your file for import</p>
          <label className="mx-3">Choose file:</label>
          <input
            ref={inputRef}
            onChange={handleDisplayFileDetails}
            className="d-none"
            type="file"
          />
          <button
            onClick={handleUpload}
            className={`btn btn-outline-${uploadedFileName ? "success" : "primary"}`}
          >
            {uploadedFileName ? uploadedFileName : "Upload"}
          </button>
          <br/>
          <Button variant="primary" type="submit" disabled={uploadedFileName === null}>Import</Button>
        </form>

        <hr/>
        <p>"The early 2010s called, they want their Twitter Bootstrap theme back!" - Vanessa Ung</p>
      </Container>   
    </>
  )
}

function App() {
  const [id, setStateID] = React.useState<string>('');
  const setID = (s: string): void => {
    setStateID(s)
  };

  return (
    <Container className="p-3">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home setID={setID} />} />
          <Route path="/import" element={<ImportApp id={id} />} />
        </Routes>
      </BrowserRouter>
    </Container>
  );
}

export default App;

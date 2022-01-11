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

class ImportApp extends React.Component<ImportAppProps, ImportAppState> {
  constructor(props: ImportAppProps) {
    super(props);
    this.state = {
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
    };
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleTextAreaChange = this.handleTextAreaChange.bind(this);
    this.handleIssueDelete = this.handleIssueDelete.bind(this);
    this.deleteAllUnimplemented = this.deleteAllUnimplemented.bind(this);
    this.handleFixSequence = this.handleFixSequence.bind(this);
    this.fixAllSequences = this.fixAllSequences.bind(this);
    this.fixAll = this.fixAll.bind(this);
    this.undoAll = this.undoAll.bind(this);
    this.setShowExport = this.setShowExport.bind(this);
    this.setShowSQLExec = this.setShowSQLExec.bind(this);
    this.handleAddStatement = this.handleAddStatement.bind(this);
    this.handleSave = this.handleSave.bind(this);
    this.setActiveStatement = this.setActiveStatement.bind(this);
    this.handleNextStatementWithIssue = this.handleNextStatementWithIssue.bind(this);
  }

  componentDidMount() {
    this.refresh();
  }

  undoAll(event: React.FormEvent<HTMLButtonElement>) {
    this.refresh();
  }


  supplyRefs(data: ImportAppState) {
    const refs: React.RefObject<HTMLTextAreaElement>[] = [];
    data.data.import_metadata.statements.forEach((statement) => {
      refs.push(React.createRef());
    })
    data.statementRefs = refs;
    data.activeStatement = -1;
    return data;
  }

  refresh() {
    this.setState({...this.state, loaded: false});
    axios.get<Import>("http://" + window.location.hostname + ":5050/get", { params: { 'id': this.props.id } }).then(
      response => {
        this.setState(this.supplyRefs({...this.state, loaded: true, data: response.data}));
      }
    ).catch(
      error => alert(`Error: ${error}`)
    );
  }

  handleSubmit() {
    this.setState({...this.state, loaded: false});
    axios.post<Import>(
      "http://" + window.location.hostname + ":5050/put",
      this.state.data,
    ).then(
      response => {
        this.setState(this.supplyRefs({...this.state, loaded: true, data: response.data}));
      }
    ).catch(
      error => alert(`Error: ${error}`)
    );
  }

  handleTextAreaChange(idx: number) {
    return (event: React.ChangeEvent<HTMLTextAreaElement>) => this.handleTextAreaChangeForIdx(idx, event)
  }

  handleTextAreaChangeForIdx  ( idx: number, event: React.ChangeEvent<HTMLTextAreaElement>) {
    const newState = this.state.data;
    newState.import_metadata.statements[idx].cockroach = event.target.value;
    this.setState({...this.state, data: newState});
  }

  handleFixSequence(statementIdx: number, issueIdentifier: string) {
    axios.post<ImportStatement>(
      "http://" + window.location.hostname + ":5050/fix_sequence",
      {
        statement: this.state.data.import_metadata.statements[statementIdx],
        id: issueIdentifier,
      },
    ).then(
      response => {
        const newState = this.state.data;
        newState.import_metadata.statements[statementIdx] = response.data;
        this.setState({...this.supplyRefs({...this.state, data: newState}), activeStatement: statementIdx});
      }
    ).catch(
      error => alert(`Error: ${error}`)
    );
  }

  handleIssueDelete(statementIdx: number, issueIdx: number) {
    const newState = this.state.data;
    newState.import_metadata.statements[statementIdx].cockroach = '';
    newState.import_metadata.statements[statementIdx].issues.splice(issueIdx, 1);
    this.setState({...this.supplyRefs({...this.state, data: newState}), activeStatement: statementIdx});
  }

  deleteAllUnimplemented(event: React.MouseEvent<HTMLButtonElement>) {  
    alert(`${this.deleteAllUnimplementedInternal()} statements deleted!`);
  }

  deleteAllUnimplementedInternal() {
    // This is bad but w/e.
    const elems: {
      statementIdx: number;
      issueIdx: number;
    }[] = [];
    this.state.data.import_metadata.statements.forEach((statement, statementIdx) => {
      if (statement.issues != null) {
        statement.issues.forEach((issue, issueIdx) => {
          if (issue.type === 'unimplemented') {
            elems.push({statementIdx: statementIdx, issueIdx: issueIdx});
          }
        })
      }
    })
    elems.forEach((elem) => this.handleIssueDelete(elem.statementIdx, elem.issueIdx));
    return elems.length;
  }


  fixAllSequences(event: React.MouseEvent<HTMLButtonElement>) {
    alert(`${this.fixAllSequencesInternal()} statements affected!`);
  }

  fixAllSequencesInternal() {
    // This is bad but w/e.
    const elems: {
      statementIdx: number;
      id: string;
    }[] = [];
    this.state.data.import_metadata.statements.forEach((statement, statementIdx) => {
      if (statement.issues != null) {
        statement.issues.forEach((issue) => {
          if (issue.type === 'sequence') {
            elems.push({statementIdx: statementIdx, id: issue.id});
          }
        })
      }
    })
    elems.forEach((elem) => this.handleFixSequence(elem.statementIdx, elem.id));
    return elems.length;
  }

  fixAll(event: React.MouseEvent<HTMLButtonElement>) {
    var text = '';
    text += `${this.fixAllSequencesInternal()} sequences converted to UUID\n`;
    text += `${this.deleteAllUnimplementedInternal()} unimplemented statements deleted\n`;
    alert(text);
  }

  setShowExport(showExport: boolean) {
    this.setState({...this.state, showExport: showExport});
  }

  setShowSQLExec(showSQLExec: boolean, text?: string) {
    this.setState({...this.state, showSQLExec: showSQLExec, sqlExecText: text != null ? text : this.state.sqlExecText});
  }

  handleAddStatement(idx: number) {
    const newState = this.state.data;
    newState.import_metadata.statements.splice(idx, 0, {
      original: '-- newly added statement',
      cockroach: '',
      issues: [],
    })
    this.setState({...this.supplyRefs({...this.state, data: newState}), activeStatement: this.state.activeStatement});
  }

  handleSave(exportText: string, fileName: string) {
    return (event: React.MouseEvent<HTMLButtonElement>) => {
      saveAs(new File([exportText], fileName, {type: "text/plain;charset=utf-8"}));
    };
  }

  setActiveStatement(idx: number) {
    this.setState({...this.state, activeStatement: idx});
  }

  handleNextStatementWithIssue() {
    for (let i = 0; i < this.state.data.import_metadata.statements.length; i++) {
      const idx = (this.state.activeStatement + i + 1) % this.state.data.import_metadata.statements.length;
      const stmt = this.state.data.import_metadata.statements[idx];
      if (stmt.issues != null && stmt.issues.length > 0) {
        const ref = this.state.statementRefs[idx];
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

  render() {
    const exportText = this.state.data.import_metadata.statements != null ? this.state.data.import_metadata.statements.map((statement) => {
      const pg = statement.original.split("\n")[0];
      pg.trim();
      var crdb = statement.cockroach;
      crdb.trim();
      if (crdb.charAt(crdb.length - 1) != ';') {
        crdb += ";";
      }
      return '-- postgres: ' + pg + '\n' + crdb + '\n';
    }).join('\n') : '';

    return (
      <>
        <Container className="bg-light p-5">
          <h1 className="display-4 fw-bold">
            {!this.state.loaded ? 'Loading database migration....' : this.state.data.id}
          </h1>
          {this.state.loaded ? 
            <>
              <Alert variant={this.state.data.import_metadata.status}>{this.state.data.import_metadata.message}</Alert>
              <hr/>
              <StatementsSummary statements={this.state.data.import_metadata.statements} />
            </>
            : ''
          }          
          <hr/>
          {this.state.loaded ? <div>Last executed&nbsp;<Moment date={new Date(this.state.data.unix_nano / 1000000).toISOString()} fromNow /></div>: ''}
        </Container>

        <Container className="p-4" fluid>
          {this.state.loaded ? 
            <>
              <ExportDialog show={this.state.showExport} onHide={() => this.setShowExport(false)} exportText={exportText} handleSave={this.handleSave(exportText, this.state.data.id + '_export.sql')} />
              <SQLExecDialog show={this.state.showSQLExec} onHide={() => this.setShowSQLExec(false)} text={this.state.sqlExecText} database={this.state.data.import_metadata.database} />
            </>
            : ''}
          <form className="p-2">
            {this.state.loaded ?
              <>
                <Button variant="outline-secondary" onClick={this.fixAll}>Fix all</Button>
                <Button variant="outline-danger" onClick={this.deleteAllUnimplemented}>Delete all unimplemented statements</Button>
                <Button variant="outline-info" onClick={this.fixAllSequences}>All sequences to UUID</Button>
                <br/>
                <Button variant="outline-primary" onClick={this.undoAll}>Undo all</Button>              
                <Button variant="secondary" onClick={(event: React.MouseEvent<HTMLButtonElement>) => this.setShowExport(true)}>Raw Import</Button>
              </> : ''
            }
            <Row className="m-2 p-2">
              <Col xs={6}><strong>PostgreSQL statement</strong></Col>
              <Col xs={6}><strong>CockroachDB statement</strong></Col>
            </Row>
            {this.state.loaded ?
              this.state.data.import_metadata.statements.map((statement, idx) => (
                <Statement 
                  key={'r' + idx} 
                  statement={statement} 
                  database={this.state.data.import_metadata.database}
                  ref={this.state.statementRefs[idx]}
                  idx={idx} 
                  callbacks={{
                    handleIssueDelete: this.handleIssueDelete,
                    handleTextAreaChange: this.handleTextAreaChange(idx),
                    handleFixSequence: this.handleFixSequence,
                    handleAddStatement: this.handleAddStatement,
                    setShowSQLExec: this.setShowSQLExec,
                    setActiveStatement: () => this.setActiveStatement(idx),
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
            {this.state.loaded ?
              <p>
                <Button variant="primary" onClick={this.handleSubmit}>Reimport</Button>
                <Button variant="secondary" onClick={this.handleSave(exportText, this.state.data.id + '_export.sql')}>Save as SQL File</Button>
                {this.state.data.import_metadata.database !== '' ? <Button variant="outline-secondary" onClick={(event: React.MouseEvent<HTMLButtonElement>) => this.setShowSQLExec(true)}>Execute SQL</Button>: ''}  
                <Button variant="danger" onClick={this.handleNextStatementWithIssue}>Scroll to Next Issue</Button>
              </p>
            : <span className="visually-hidden">Loading...</span>}
          </Container>
        </footer>
      </>
    );
  }
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
    setSt({...st, text: props.text});
  }, [st, props.text])

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
                  {st.results.columns.map((c) => <th>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {st.results.rows.map((row) => 
                  <tr>
                    {row.map((c) => <td>{c}</td>)}
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

function ExportDialog(props: {onHide: () => void; show: boolean, exportText: string, handleSave: (event: React.MouseEvent<HTMLButtonElement>) => void}) {
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
    .map(part =>
      URL_REGEX.test(part) ? <>
        <a href={part} target="_blank" rel="noreferrer">{part}</a>&nbsp;
      </> : (part + " ")
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

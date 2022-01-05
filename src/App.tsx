import React from 'react';

import Alert from 'react-bootstrap/Alert';
import Container from 'react-bootstrap/Container';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import './App.css';
import Moment from 'react-moment';

import { useNavigate, BrowserRouter, Route, Routes } from 'react-router-dom';

import axios from 'axios';
import { statements } from '@babel/template';


interface Import {
  id: string;
  unix_nano: number;
  import_metadata: ImportMetadata;
}

interface ImportMetadata {
  statements: ImportStatement[];
  status: string;
  message: string;
}

interface ImportStatement {
  original: string;
  cockroach: string;
  issues: ImportIssue[];
}

interface ImportIssue {
  level: string;
  text: string;
  type: string;
}

interface ImportAppState {
  data: Import;
  loaded: boolean;
}

interface ImportAppProps {
  id: string;  
}

class ImportApp extends React.Component<ImportAppProps, ImportAppState> {
  constructor(props: ImportAppProps) {
    super(props);
    this.state = {
      loaded: false,
      data: {
        id: props.id,
        unix_nano: 0,
        import_metadata: {
          statements: [],
          status: "",
          message: "",
        },
      },
    };
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleTextAreaChange = this.handleTextAreaChange.bind(this);
    this.handleIssueDelete = this.handleIssueDelete.bind(this);
    this.deleteAllUnimplemented = this.deleteAllUnimplemented.bind(this);
  }

  componentDidMount() {
    axios.get<Import>("http://" + window.location.hostname + ":5050/get", { params: { 'id': this.props.id } }).then(
      response => {
        this.setState({...this.state, loaded: true, data: response.data});
      }
    ).catch(
      error => console.error(`Error: ${error}`)
    );
  }

  handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    this.setState({...this.state, loaded: false});
    axios.post<Import>(
      "http://" + window.location.hostname + ":5050/put",
      this.state.data,
    ).then(
      response => {
        this.setState({...this.state, loaded: true, data: response.data});
      }
    ).catch(
      error => console.error(`Error: ${error}`)
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

  handleIssueDelete(statementIdx: number, issueIdx: number) {
    const newState = this.state.data;
    newState.import_metadata.statements[statementIdx].cockroach = '';
    newState.import_metadata.statements[statementIdx].issues.splice(issueIdx, 1);
    this.setState({...this.state, data: newState});
  }

  // react doesn't really like this as it doesn't like raw HTML, TODO figure out something smarter i guess.
  hyperlinkText(inputText: string) {
    //URLs starting with http://, https://, or ftp://
    const replacePattern1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/gim;
    return inputText.replace(replacePattern1, '<a href="$1" target="_blank">$1</a>');
  }

  deleteAllUnimplemented(event: React.MouseEvent<HTMLButtonElement>) {
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
    alert(`${elems.length} statements deleted!`);
  }

  render() {
    return (
      <>
        <Container className="bg-light p-5">
          <h1 className="display-4 fw-bold">
            {!this.state.loaded ? 'Loading database migration....' : this.state.data.id}
          </h1>
          {this.state.loaded ? 
            <Alert variant={this.state.data.import_metadata.status}>{this.state.data.import_metadata.message}</Alert>
            : ''
          }
          <hr/>
          {this.state.loaded ? <div>Last executed&nbsp;<Moment date={new Date(this.state.data.unix_nano / 1000000).toISOString()} fromNow /></div>: ''}
        </Container>

        <Container className="p-4" fluid>
          <form onSubmit={this.handleSubmit} className="p-2">
            <Button variant="primary" type="submit">Reimport</Button>
            <Button variant="outline-danger" onClick={this.deleteAllUnimplemented}>Delete all unimplemented statements</Button>

            <Row className="m-2 p-2">
              <Col xs={6}><strong>PostgreSQL statement</strong></Col>
              <Col xs={6}><strong>CockroachDB statement</strong></Col>
            </Row>
            {this.state.loaded ?
              this.state.data.import_metadata.statements.map((statement, idx) => (
                <Statement 
                  key={'r' + idx} 
                  statement={statement} 
                  idx={idx} 
                  handleIssueDelete={this.handleIssueDelete} 
                  handleTextAreaChange={this.handleTextAreaChange(idx)} />
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
      </>
    );
  }
}

interface StatementProps {
  statement: ImportStatement;
  idx: number;
  handleIssueDelete: (statementIdx: number, issueIdx: number) => void;
  handleTextAreaChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

function Statement(props: StatementProps) {
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

  const onDelete = (idx: number) => (event: React.MouseEvent<HTMLButtonElement>) => {
    props.handleIssueDelete(props.idx, idx);
  };

  return (
    <Row className={"m-2 p-2 border " + (colorForIssue(statement.issues) != null ? 'border-' + colorForIssue(statement.issues): '')}>
      <Col xs={6}>
        <pre>{statement.original}</pre>
      </Col>
      <Col xs={6}>
        <ul>
          {statement.issues != null && statement.issues.length > 0 ? statement.issues.map((issue, idx) => (
            <li key={'li' + idx} className={"issue-level-" + issue.level}>
              {issue.text}
              {issue.type === 'unimplemented' ? (
                <Button variant="outline-danger" onClick={onDelete(idx)}>Delete Statement</Button>
              ) : ''}
            </li>
          )): ''}
        </ul>
        <textarea
          className="form-control"
          id={'ta' + props.idx}
          value={statement.cockroach}
          placeholder={statement.cockroach.trim() === '' ? '-- statement ignored': ''}
          onChange={props.handleTextAreaChange}
        />
      </Col>
    </Row>
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
          className={`btn btn-outline-${
            uploadedFileName ? "success" : "primary"
          }`}
        >
          {uploadedFileName ? uploadedFileName : "Upload"}
        </button>
        <br/>
        <Button variant="primary" type="submit" disabled={uploadedFileName === null}>Import</Button>
      </form>
    </Container>   
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

      <hr/>
      <p>"The early 2010s called, they want their Twitter Bootstrap theme back!" - Vanessa Ung</p>
    </Container>
  );
}

export default App;

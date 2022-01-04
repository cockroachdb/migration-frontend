import React from 'react';

import Alert from 'react-bootstrap/Alert';
import Container from 'react-bootstrap/Container';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';

import Moment from 'react-moment';

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
}

interface ImportStatement {
  original: string;
  cockroach: string;
  issues: ImportIssue[];
}

interface ImportIssue {
  type: string;
  text: string;
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
            <Row className="m-2 p-2">
              <Col xs={6}><strong>PostgreSQL statement</strong></Col>
              <Col xs={6}><strong>CockroachDB statement</strong></Col>
            </Row>
            {this.state.loaded ? this.state.data.import_metadata.statements.map((statement, idx) => (
              <Row key={'r' + idx} className={"m-2 p-2 border " + (statement.issues != null && statement.issues.length > 0 ? 'border-danger': '')}>
                <Col xs={6}>
                  <pre>{statement.original}</pre>
                </Col>
                <Col xs={6}>
                    <ul>
                      {statement.issues != null && statement.issues.length > 0 ? statement.issues.map((issue, idx) => (
                          <li key={'li' + idx} style={{color: 'red'}}>{issue.text}</li>
                      )): ''}
                    </ul>
                    <textarea
                      className="form-control"
                      id={'ta' + idx}
                      value={statement.cockroach}
                      placeholder={statement.cockroach.trim() === '' ? '-- statement ignored': ''}
                      onChange={this.handleTextAreaChange(idx)}
                    />
                </Col>
              </Row>
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

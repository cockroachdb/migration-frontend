import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Spinner, Button } from "react-bootstrap";
import axios from "axios";

import type { Import } from "../import";

export interface HomeProps {
  setID: (s: string) => void;
}

export const Home: React.FC<HomeProps> = (props: HomeProps) => {
  const [state, setState] = useState<{uploadedFileName: string | null, loading: boolean}>({
    uploadedFileName: null,
    loading: false,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = () => {
    inputRef.current?.click();
  };
  const handleDisplayFileDetails = () => {
    inputRef.current?.files &&
      setState({...state, uploadedFileName: inputRef.current.files[0].name});
  };  
  let navigate = useNavigate();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inputRef.current == null || inputRef.current.files == null || state.uploadedFileName == null) {
      return;
    }
    setState({...state, loading: true});
    const formData = new FormData();
    formData.append("file", inputRef.current.files[0]);
    formData.append("id", state.uploadedFileName);
    axios.post<Import>(
      "http://" + window.location.hostname + ":5050/upload",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    ).then(
      response => {
        props.setID(response.data.id);
        navigate("/import"); // ?id=" + response.data.id);
      }
    ).catch(
      error => {
        alert(`Error: ${error}`);
        setState({...state, loading: false});
      }
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
          <p>Upload your file for import.</p>
          <p>Since this application is not very smart, <strong>name your file something unique to you, e.g. <code>otan_example.sql</code></strong>, or you may overwrite or view someone else's attempt.</p>
          <p>INSERT and COPY statements will not appear.</p>
          <label className="mx-3">Choose file:</label>
          <input
            ref={inputRef}
            onChange={handleDisplayFileDetails}
            className="d-none"
            type="file"
          />
          <button
            onClick={handleUpload}
            className={`btn btn-outline-${state.uploadedFileName ? "success" : "primary"}`}
          >
            {state.uploadedFileName ? state.uploadedFileName : "Upload"}
          </button>
          <br/>
          {state.loading ? 
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner> :
            <Button variant="primary" type="submit" disabled={state.uploadedFileName === null}>Import</Button>
          }
        </form>

        <hr/>
        <p>"The early 2010s called, they want their Twitter Bootstrap theme back!" - Vanessa Ung</p>
      </Container>   
    </>
  )
};

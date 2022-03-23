import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import classnames from "classnames/bind";

import { Heading, Text, Button, Spinner, Icon  } from "@cockroachlabs/ui-components";

import type { Import } from "../../common/import";
import TitleBar from "../components/TitleBar";
import Container from "../components/Container";

import styles from  "./Home.module.scss";

export interface HomeProps {
  setID: (s: string) => void;
}

const cx = classnames.bind(styles);

const Hr = () => (
  <hr className={cx("horizontal-rule")} />
);

export const Home: React.FC<HomeProps> = (props: HomeProps) => {
  const [state, setState] = useState<{uploadedFileName: string | null, loading: boolean}>({
    uploadedFileName: null,
    loading: false,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = () => {
    if (state.uploadedFileName && inputRef.current?.files) {
      inputRef.current.value = "";
      setState({...state, uploadedFileName: null});
      return;
    }

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
      <TitleBar />
      <Container>
        <Heading type="h1">
          SQL Importer
        </Heading>

        <form onSubmit={handleSubmit}>
          <p>
            <Text type="body">
              Upload your file for import.
              Since this application is not very smart, name your
              file something unique to you, e.g. otan_example.sql, or
              you may overwrite or view someone else's attempt.
              INSERT and COPY statements will not appear.
            </Text>
          </p>

          <Hr/>

          <input
            ref={inputRef}
            onChange={handleDisplayFileDetails}
            className="d-none"
            type="file"
          />
          <Button
            onClick={handleUpload}
            intent="secondary"
          >
            {!state.uploadedFileName && (
              <Icon iconName="PlusCircle" className={cx("upload-button-icon-left")} />
            )}
            {state.uploadedFileName ? state.uploadedFileName : "Choose a file"}
            {state.uploadedFileName && (
              <Icon iconName="Cancel" className={cx("upload-button-icon-right")} />
            )}
          </Button>

          <Hr/>

          {state.loading ?
            <Spinner size="large" className={cx("upload-spinner")} />
            :
            <Button intent="primary" type="submit" disabled={state.uploadedFileName === null}>Import File</Button>
          }
        </form>


      </Container>
    </>
  )
};

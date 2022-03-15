import type React from "react";
import { useState, useEffect } from "react";
import axios from "axios";
import { Modal, Button, Table } from "react-bootstrap";


interface SQLExecDialogProps {
  show: boolean;
  onHide: () => void;
  text: string;
  database: string;
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

export const SQLExecDialog: React.FC<SQLExecDialogProps> = (props) => {
  const [st, setSt] = useState<SQLExecState>({
    text: props.text,
    results: null,
  });

  useEffect(() => {
    setSt((s) => ({ ...s, text: props.text }));
  }, [props.text]);

  const handleTextAreaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) =>
    setSt({ ...st, text: event.target.value });

  const handleExecute = () => {
    axios.post<SQLExecResults>(
      "http://" + window.location.hostname + ":5050/sql",
      { database: props.database, sql: st.text },
    ).then(
      response => {
        setSt({ ...st, results: response.data });
      }
    ).catch(
      error => setSt({ ...st, text: error })
    );
  };

  return (
    <Modal show={props.show} onHide={() => {
      props.onHide();
      setSt({ ...st, results: null });
    }} >
      <Modal.Header closeButton>
        <Modal.Title>Execute Raw SQL</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p>This statement will execute on the temporarily created database. It will not be part of the import.</p>
        <textarea
          value={st.text}
          style={{ width: '100%' }}
          onChange={handleTextAreaChange}
        />
        <br />
        <Button variant="primary" onClick={handleExecute}>Execute</Button>
        {st.results != null ?
          <>
            <hr />
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


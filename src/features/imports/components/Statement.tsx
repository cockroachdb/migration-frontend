import React, { useCallback } from "react";
import { Row, Col, Button, ButtonGroup } from 'react-bootstrap';

import type { ImportIssue } from "../../../common/import";
import { importsSlice, Statement as StatementType } from "../importsSlice";
import { modalSlice } from "../../modals/modalSlice";
import { useAppDispatch } from "../../../app/hooks";

interface StatementProps {
  statement: StatementType;
  idx: number;
  database: string;
  callbacks: {
    handleFixSequence: (statementIdx: number, issueIdentifier: string) => void;
    handleTextAreaChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
    setActiveStatement: () => void;
    handleAddUser: (user: string) => void;
  }
}

export const Statement = React.forwardRef<HTMLTextAreaElement, StatementProps>((props, ref) => {
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

  const dispatch = useAppDispatch();
  const toggleDelete = useCallback(() => {
    dispatch(importsSlice.actions.toggleSoftDeletion([ statement ]));
  }, [ dispatch, statement ]);
  const onInsertAbove = useCallback(() => {
    dispatch(
      importsSlice.actions.insertStatement({
        importId: statement.importId,
        index: props.idx,
      })
    );
  }, [ dispatch, props.idx, statement.importId ]);
  const onInsertBelow = useCallback(() => {
    dispatch(
      importsSlice.actions.insertStatement({
        importId: statement.importId,
        index: props.idx + 1,
      })
    );
  }, [ dispatch, props.idx, statement.importId ]);
  const showExecuteModal = useCallback(() => {
    dispatch(modalSlice.actions.showRawSql(statement.cockroach));
  }, [ dispatch, statement.cockroach ]);

  const onFixSequence = (statementIdx: number, issueIdentifier: string) =>
    () => props.callbacks.handleFixSequence(statementIdx, issueIdentifier)

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
    <Row className={"m-2 p-2 border " + (colorForIssue(statement.issues) != null ? 'border-' + colorForIssue(statement.issues) : '')}>
      <Col xs={6}>
        <pre>{statement.original}</pre>
      </Col>
      <Col xs={6}>

        <ul>
          {statement.issues != null && statement.issues.length > 0 ? statement.issues.map((issue, idx) => (
            <li key={'li' + idx} className={"issue-level-" + issue.level}>
              {hyperlinkText(issue.text)}
              {issue.type === 'unimplemented' ? (
                <Button variant="outline-danger" onClick={toggleDelete}>{statement.deleted ? "Restore Statement" : "Delete statement"}</Button>
              ) : ''}
              {issue.type === "sequence" ? (
                <Button variant="outline-info" onClick={onFixSequence(props.idx, issue.id)}>Make UUID</Button>
              ) : ''}
              {issue.type === "missing_user" ? (
                <Button variant="outline-info" onClick={() => props.callbacks.handleAddUser(issue.id)}>Add user "{issue.id}"</Button>
              ) : ''}
            </li>
          )) : ''}
        </ul>
        <textarea
          className="form-control"
          id={'ta' + props.idx}
          value={statement.deleted ? '' : statement.cockroach}
          ref={ref}
          placeholder={statement.deleted ? '-- statement ignored' : statement.cockroach}
          onChange={props.callbacks.handleTextAreaChange}
          onFocus={() => props.callbacks.setActiveStatement()}
          rows={statement.cockroach.split('\n').length + 1}
        />

        <p style={{ textAlign: 'center' }}>
          <ButtonGroup>
            <Button variant="outline-primary" onClick={onInsertAbove}>Insert Before</Button>
            <Button variant="outline-primary" onClick={onInsertBelow}>Insert After</Button>
            <Button variant="outline-secondary" onClick={toggleDelete}>{statement.deleted ? "Restore" : "Delete"}</Button>
            <Button variant="outline-primary" onClick={showExecuteModal} disabled={props.database === ""}>Execute</Button>
          </ButtonGroup>
        </p>
      </Col>
    </Row>
  )
});

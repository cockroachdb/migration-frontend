import React, { useCallback, useEffect, useState } from "react";
import { Row, Col, Button, ButtonGroup } from 'react-bootstrap';

import type { ImportIssue } from "../../../common/import";
import { getSelectorsForImportId, importsSlice, Statement as StatementType } from "../importsSlice";
import { modalSlice } from "../../modals/modalSlice";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import { useAddUser } from "../hooks";

interface StatementProps {
  statement: StatementType;
  idx: number;
  database: string;
  callbacks: {
    handleFixSequence: (statementIdx: number, issueIdentifier: string) => void;
    setActiveStatement: () => void;
  }
}

export const Statement = React.forwardRef<HTMLTextAreaElement, StatementProps>((props, ref) => {
  const importId = props.statement.importId;
  const statementId = props.statement.id;
  const statementSelectors = useAppSelector((state) => getSelectorsForImportId(state, importId));
  const statement = useAppSelector((state) => statementSelectors!.selectById(state, statementId))!;

  const [ crdbStmt, setCrdbStmt ] = useState(statement?.cockroach || "");

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

  const onAddUser = useAddUser();

  // Publish statement changes when focus leaves the <textarea>
  const onBlur = useCallback(
    () => dispatch(
      importsSlice.actions.setStatementText({
        statement: statement,
        cockroach: crdbStmt,
      })
    ),
    [ dispatch, crdbStmt ]
  );

  // Overwrite the local statement whenever the <textarea> changes
  const onChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCrdbStmt(event.target.value);
  }, [setCrdbStmt]);

  // Overwrite the local statement if the representation in the store changes
  useEffect(
    () => setCrdbStmt(statement.cockroach),
    [ statement.cockroach, setCrdbStmt ]
  );

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
                <Button variant="outline-info" onClick={() => onAddUser(issue.id, props.idx, statement.importId, statement)}>Add user "{issue.id}"</Button>
              ) : ''}
            </li>
          )) : ''}
        </ul>
        <textarea
          className="form-control"
          id={'ta' + props.idx}
          value={statement.deleted ? '' : crdbStmt}
          ref={ref}
          placeholder={statement.deleted ? '-- statement ignored' : statement.cockroach}
          onBlur={onBlur}
          onChange={onChange}
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

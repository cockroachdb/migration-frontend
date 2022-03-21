import { useState } from "react";
import { Form, Modal, Button } from 'react-bootstrap';
import { useAppDispatch } from "../../app/hooks";
import { modalSlice } from "./modalSlice";

export interface FindAndReplaceDialogProps {
  show: boolean;
  findAndReplace: (args: FindAndReplaceArgs) => void;
}

export interface FindAndReplaceArgs {
  find: string;
  replace: string;
  isRegex: boolean;
}

export const FindAndReplaceDialog: React.FC<FindAndReplaceDialogProps> = (props) => {
  const [state, setState] = useState<FindAndReplaceArgs>({
    find: '',
    replace: '',
    isRegex: false,
  });

  const dispatch = useAppDispatch();
  const hideModal = () => dispatch(modalSlice.actions.hideAll());

  const setFindText = (event: React.ChangeEvent<HTMLInputElement>) =>
    setState({ ...state, find: event.target.value });
  const setReplaceText = (event: React.ChangeEvent<HTMLInputElement>) =>
    setState({ ...state, replace: event.target.value });
  const setIsRegex = (event: React.ChangeEvent<HTMLInputElement>) =>
    setState({ ...state, isRegex: event.target.checked });

  return (
    <Modal show={props.show} onHide={hideModal} >
      <Modal.Header closeButton>
        <Modal.Title>Find and Replace</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form>
          <Form.Group className="mb-3" controlId="exampleForm.ControlInput1">
            <Form.Label>Find</Form.Label>
            <Form.Control type="text" placeholder="Find text" value={state.find} onChange={setFindText} />
          </Form.Group>
          <Form.Group className="mb-3" controlId="exampleForm.ControlInput2">
            <Form.Label>Replace</Form.Label>
            <Form.Control type="text" placeholder="Replace text (use $1 for capture groups)" value={state.replace} onChange={setReplaceText} />
          </Form.Group>
          <Form.Group className="mb-3" controlId="exampleForm.ControlInput3">
            <Form.Label>Regex?</Form.Label>
            <Form.Check type="checkbox" checked={state.isRegex} onChange={setIsRegex} />
          </Form.Group>
          <Button variant="primary" onClick={() => props.findAndReplace(state)}>Execute</Button>
        </Form>
      </Modal.Body>
    </Modal>
  )
};

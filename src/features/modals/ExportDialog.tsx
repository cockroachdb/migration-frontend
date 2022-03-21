import { Modal, Button } from "react-bootstrap";
import { useAppDispatch } from "../../app/hooks";
import { modalSlice } from "./modalSlice";

interface ExportDialogProps {
  show: boolean;
  exportText: string;
  handleSave: () => void;
}

export const ExportDialog: React.FC<ExportDialogProps> = (props) => {
  const dispatch = useAppDispatch();
  const hideModal = () => dispatch(modalSlice.actions.hideAll());
  return (
    <Modal show={props.show} onHide={hideModal}>
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
};

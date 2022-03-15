import { Modal, Button } from "react-bootstrap";

interface ExportDialogProps {
  onHide: () => void;
  show: boolean;
  exportText: string;
  handleSave: () => void;
}

export const ExportDialog: React.FC<ExportDialogProps> = (props) => {
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
};

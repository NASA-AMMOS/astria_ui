import PropTypes from 'prop-types';
import React from 'react';
import Modal from 'react-modal';
import Button from 'src/components/common/Button';
import alertStyles from 'src/styles/Alert.module.css';
import { performElasticSearchQuery } from 'src/utils';
import { datadriveDeleteFile } from 'src/utils/endpoints';
import * as telemetry from 'src/utils/telemetryUtils';

class AnnotationDeletionModal extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      deletingAnnotation: false,
      deletionSuccess: false,
      deletionAttempted: false,
    };
  }

  async fetchThumbnail(thumbnailPath) {
    const body = {
      query: { match: { ocs_url: thumbnailPath } },
      size: 1,
    };

    try {
      const json = await performElasticSearchQuery(body);
      if (!json.hits || !json.hits.hits || !json.hits.hits.length) {
        return;
      } else return json.hits.hits[0]._source;
    } catch (err) {
      telemetry.logError(`Unable to check for annotation thumbnail existence: ${thumbnailPath}`, err);
      return;
    }
  }

  closeModal = () => {
    this.props.close();
  };

  handleDelete = async () => {
    const { annotationToDelete } = this.props;

    const onSuccess = () => {
      this.props.removeAnnotation(annotationToDelete, false);
      this.props.locallyRemoveAnnotation(annotationToDelete);
      this.closeModal();
      this.setState({
        deletingAnnotation: false,
        deletionSuccess: true,
        deletionAttempted: true,
        title: '',
        description: '',
      });
    };

    // If it's a local annotation (e.g. not stored in OCS yet)
    // we don't need to make the delete call
    if (annotationToDelete.isLocal) onSuccess();
    else {
      this.setState({ deletingAnnotation: true, deletionSuccess: false, deletionAttempted: false });

      // Fetch thumbnail
      const thumbnailOCSResult = await this.fetchThumbnail(annotationToDelete.thumbnail);

      const toDelete = [datadriveDeleteFile(annotationToDelete.ocs_package_id, annotationToDelete.ocs_dataset_id)];
      if (thumbnailOCSResult) {
        toDelete.push(datadriveDeleteFile(thumbnailOCSResult.ocs_package_id, thumbnailOCSResult.ocs_dataset_id));
      }
      Promise.all(toDelete)
        .then(() => onSuccess())
        .catch((err) => {
          this.setState({ deletingAnnotation: false, deletionSuccess: false, deletionAttempted: true });
          telemetry.logError(
            `Unable to delete active annotation files for annotation id: ${annotationToDelete.annotation_id}`,
            err
          );
        });
    }
  };

  render() {
    const { deletingAnnotation, deletionSuccess, deletionAttempted } = this.state;
    const { deleteModalOpen } = this.props;

    let deleteBtnText = '';
    if (deletingAnnotation) deleteBtnText = 'Working...';
    else {
      if (deletionAttempted && !deletionSuccess) deleteBtnText = 'Retry';
      else deleteBtnText = 'Delete';
    }
    return (
      <Modal
        overlayClassName={{
          base: alertStyles.overlayBase,
          afterOpen: alertStyles.afterOpen,
          beforeClose: alertStyles.beforeClose,
        }}
        className={alertStyles.alert}
        isOpen={deleteModalOpen}
        onRequestClose={() => this.props.close()}
        shouldCloseOnOverlayClick={false}
        shouldCloseOnEsc={false}
      >
        <div className={alertStyles.headerContainer}>
          <div className={alertStyles.title}>Delete Drawing Overlay?</div>
        </div>
        <div className={alertStyles.message}>
          Are you sure you would like to delete this drawing overlay? This action cannot be undone.
        </div>
        <div className={alertStyles.actionRow}>
          {!deletingAnnotation && <Button variant="secondary" text="Cancel" onClick={this.closeModal} />}
          <Button
            variant="primary"
            disabled={deletingAnnotation}
            text={deleteBtnText}
            onClick={() => this.handleDelete()}
          />
        </div>
      </Modal>
    );
  }
}

AnnotationDeletionModal.defaultProps = {
  annotationToDelete: null,
  deleteModalOpen: false,
};

AnnotationDeletionModal.propTypes = {
  annotationToDelete: PropTypes.object,
  deleteModalOpen: PropTypes.bool,
  removeAnnotation: PropTypes.func,
  locallyRemoveAnnotation: PropTypes.func,
};

export default AnnotationDeletionModal;

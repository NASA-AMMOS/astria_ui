import axios from 'axios';
import classNames from 'classnames';
import { Field, Form, Formik } from 'formik';
import PropTypes from 'prop-types';
import React from 'react';
import Dropzone from 'react-dropzone';
import Modal from 'react-modal';
import sanitize from 'sanitize-filename';
import shortid from 'shortid';
import Button from 'src/components/common/Button';
import { CheckIcon, WarningIcon } from 'src/components/common/Icons';
import alertStyles from 'src/styles/Alert.module.css';
import formStyles from 'src/styles/Forms.module.css';
import imageUploadStyles from 'src/styles/ImageUpload.module.css';
import { performElasticSearchQuery } from 'src/utils';
import { getConfig } from 'src/utils/configRegistry';

const getInitialState = () => ({
  selectedFile: null,
  uploadAttempted: false,
  uploadSuccess: false,
  uploadCanceled: false,
  uploading: false,
  uploadProgress: 0,
  uploadedObject: {},
  values: {
    time1: '',
    instrument: '',
    description: '',
    is_source_product: true,
    size_type: getConfig().image_upload.size_type,
  },
});

class ImageUpload extends React.Component {
  constructor(props) {
    super(props);

    const { values, ...rest } = getInitialState();
    this.state = { values: { ...values }, ...rest };

    this.onImageSelect = this.onImageSelect.bind(this);
    this.uploadHandler = this.uploadHandler.bind(this);
    this.onSolChange = this.onSolChange.bind(this);
    this.cancelUpload = this.cancelUpload.bind(this);
    this.onClose = this.onClose.bind(this);
    this.removeSelectedFile = this.removeSelectedFile.bind(this);
    this.uploadAbortController = null;
  }

  /*
   * Sets state with file selected for upload.
   *
   * */
  onImageSelect(file) {
    this.setState({ selectedFile: file[0] });
  }

  onSolChange(sol) {
    const values = { ...this.state.values };
    values.time1 = sol;
    this.setState({ values });
  }

  onClose() {
    const { values, ...rest } = getInitialState();
    const { onClose: propsOnClose } = this.props;

    this.setState({ values: { ...values }, ...rest });
    propsOnClose();
  }

  removeSelectedFile(e) {
    e.stopPropagation();
    this.setState({ selectedFile: null });
  }

  /**
   * Cancel upload using cancel handler we created during the axios request.
   */
  cancelUpload() {
    this.setState({ uploadCanceled: true });
    this.uploadAbortController?.abort();
  }

  async fetchProduct(datasetId) {
    const config = getConfig();
    try {
      // Right now we'll only check for a search product param
      // but in the future we'll want to manage a set of url params.

      const body = {
        query: {
          match: {
            [config.es_mappings.dataset_id.key]: datasetId,
          },
        },
        size: 1,
      };

      try {
        const json = await performElasticSearchQuery(body);
        // sanity check response
        if (!json.hits || !json.hits.hits || !json.hits.hits.length) {
          throw Error('Bad response');
        } else {
          return json.hits.hits[0]._source;
        }
      } catch (_err) {
        return null;
      }
    } catch (_err) {
      return null;
    }
  }

  /*
   * Upload to DataDrive using the Manual Upload API.
   * */
  uploadHandler() {
    const config = getConfig();
    // TODO this isn't working, request is silently not starting
    const { values, selectedFile } = this.state;
    this.setState({ uploading: true, uploadAttempted: true, uploadCanceled: false });

    const onSuccess = async (res) => {
      const fetchProductWithRetries = async (id, i = 0) => {
        const maxRetries = 5;
        if (i > maxRetries) {
          this.setState({
            uploadSuccess: false,
            uploading: false,
            uploadProgress: 0,
          });
          return;
        }
        const esProduct = await this.fetchProduct(id);
        if (esProduct) {
          this.setState({
            uploadedObject: esProduct,
            uploadSuccess: true,
            uploading: false,
            uploadProgress: 0,
          });
          return;
        }
        if (!esProduct) {
          setTimeout(() => fetchProductWithRetries(id, ++i), 1000);
        }
      };

      const datasetId = res.data.dataset_id;
      fetchProductWithRetries(datasetId);
    };

    const onError = (err) => {
      let uploadSuccess = true;
      if (err && err.message !== 'USER_CANCEL') uploadSuccess = false;
      this.setState({
        uploadSuccess,
        uploading: false,
        uploadProgress: 0,
      });
    };

    // Assign a group id to the metadata
    const metadata = { group_id: shortid.generate(), ...values };
    const sanitizedFilename = sanitize(selectedFile.name);

    const fileData = new FormData();
    fileData.append('pkg_id', config.image_upload.pkg_id);
    fileData.append('ocs_path', config.image_upload.ocs_path);
    fileData.append('ocs_name', sanitizedFilename);
    fileData.append('overwrite', config.image_upload.is_overwrite);
    fileData.append('metadata', JSON.stringify(metadata));
    fileData.append('object_type_name', config.image_upload.object_type);
    fileData.append('s3_key', sanitizedFilename);
    fileData.append('s3_bucket', config.image_upload.s3_bucket);
    fileData.append('file', selectedFile);

    this.uploadAbortController = new AbortController();
    axios
      .post(config.api_endpoints.datadrive.middleware + `/api/UploadManual`, fileData, {
        withCredentials: true,
        signal: this.uploadAbortController.signal,
        onUploadProgress: (progressEvent) => {
          this.setState({ uploadProgress: Math.round((progressEvent.loaded * 100) / progressEvent.total) });
        },
      })
      .then((res) => onSuccess(res))
      .catch((err) => onError(err));
  }

  render() {
    const config = getConfig();
    const { open, setActiveSearchProduct } = this.props;
    const {
      values,
      selectedFile,
      uploading,
      uploadProgress,
      uploadSuccess,
      uploadAttempted,
      uploadCanceled,
      uploadedObject,
    } = this.state;

    // Validation really just used as an onChange
    const validate = (newValues) => {
      this.setState({ values: newValues });
    };

    const formClass = classNames({
      [imageUploadStyles.uploading]: uploading || (uploadSuccess && !uploadCanceled),
    });

    const dropzoneClass = classNames({
      [formStyles.dropzone]: true,
      [imageUploadStyles.uploading]: uploading || (uploadSuccess && !uploadCanceled),
    });

    return (
      <Modal
        overlayClassName={{
          base: alertStyles.overlayBase,
          afterOpen: alertStyles.afterOpen,
          beforeClose: alertStyles.beforeClose,
        }}
        className={alertStyles.alert}
        isOpen={open}
        onRequestClose={this.onClose}
        contentLabel="Image Upload"
        shouldCloseOnOverlayClick={false}
        shouldCloseOnEsc={false}
      >
        <div className={alertStyles.headerContainer}>
          <div className={alertStyles.title}>Image Upload</div>
        </div>
        <div className={alertStyles.message}>
          Upload quicklooks, autolooks, and other custom images and PDFs to view them in {config.app_title} and other
          tools.
        </div>
        <Dropzone
          disabled={uploading}
          onDrop={this.onImageSelect}
          accept=".png, .jpg, .jpeg, .jpe, .jif, .jfif, .jfi, .gif, .pdf, .tif"
        >
          {({ getRootProps, getInputProps }) => (
            <div className={dropzoneClass}>
              <div {...getRootProps({ className: formStyles.dropzoneElement })}>
                <input {...getInputProps()} aria-label="file-upload" />
                {!selectedFile && (
                  <div>
                    Drag and drop a file here, or click to select a file. Accepted file types are PNG, JPEG, GIF, and
                    PDF.
                  </div>
                )}
                {selectedFile && (
                  <div>
                    <div>{selectedFile.name}</div>
                    <Button variant="secondary" disabled={uploading} text="Remove" onClick={this.removeSelectedFile} />
                  </div>
                )}
              </div>
            </div>
          )}
        </Dropzone>

        <Formik
          initialValues={values}
          validate={validate}
          onSubmit={(newValues) => {
            // Case where we want to view the file
            if (uploadAttempted && uploadSuccess && !uploadCanceled) {
              setActiveSearchProduct(uploadedObject);
              this.onClose();
            } else {
              // Otherwise it's a submit action
              this.setState({ values: newValues });
              this.uploadHandler();
            }
          }}
        >
          <Form className={formStyles.form} autoComplete="off">
            <div className={formClass}>
              <div className={formStyles.textInputs}>
                <div className={formStyles.inputWithLabel}>
                  <div className={formStyles.label}>
                    Sol&nbsp;<span className={formStyles.labelRequired}>(required)</span>
                  </div>
                  <Field
                    disabled={uploading}
                    min={0}
                    type="number"
                    name="time1"
                    className={formStyles.textInput}
                    maxLength="10"
                    required
                  />
                </div>
                <div className={formStyles.inputWithLabel}>
                  <div className={formStyles.label}>Instrument</div>
                  <Field
                    disabled={uploading}
                    type="text"
                    name="instrument"
                    className={formStyles.textInput}
                    maxLength="20"
                  />
                </div>
              </div>
              <div className={formStyles.inputWithLabel}>
                <div className={formStyles.labelWithLengthCounter}>
                  <div className={formStyles.label}>Description</div>
                  <div className={formStyles.lengthCounter}>{values.description.length}/280</div>
                </div>
                <Field
                  disabled={uploading}
                  component="textarea"
                  type="text"
                  name="description"
                  className={formStyles.textarea}
                  maxLength={280}
                />
              </div>
            </div>
            <div className={alertStyles.actionRow}>
              {!uploading && uploadAttempted && !uploadSuccess && !uploadCanceled && (
                <div className={formStyles.errorMessage}>
                  <WarningIcon />
                  Upload Failed
                </div>
              )}
              {!uploading && uploadAttempted && uploadSuccess && !uploadCanceled && (
                <div className={formStyles.successMessage}>
                  <CheckIcon />
                  Upload Succeeded
                </div>
              )}
              {uploading && (
                <>
                  <Button
                    disabled={uploadProgress === 100}
                    variant="secondary"
                    text="Cancel Upload"
                    onClick={this.cancelUpload}
                  />
                  <Button
                    variant="progress"
                    text={uploadProgress < 100 ? 'Uploading...' : 'Processing...'}
                    progress={uploadProgress}
                  />
                </>
              )}
              {!uploading && (
                <>
                  <Button variant="secondary" text={!uploadAttempted ? 'Cancel' : 'Close'} onClick={this.onClose} />
                  <Button
                    variant="primary"
                    text={
                      uploadAttempted && uploadSuccess && !uploadCanceled
                        ? 'View File'
                        : uploadAttempted && !uploadSuccess && !uploadCanceled
                        ? 'Retry'
                        : 'Upload'
                    }
                    type="submit"
                    disabled={uploading || !selectedFile || typeof values.time1 !== 'number'}
                  />
                </>
              )}
            </div>
          </Form>
        </Formik>
      </Modal>
    );
  }
}

ImageUpload.defaultProps = {
  open: false,
};

ImageUpload.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  setActiveSearchProduct: PropTypes.func.isRequired,
};

export default ImageUpload;

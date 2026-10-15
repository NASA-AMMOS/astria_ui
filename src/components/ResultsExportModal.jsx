import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import Modal from 'react-modal';
import Button from 'src/components/common/Button';
import alertStyles from 'src/styles/Alert.module.css';
import FormsStyles from 'src/styles/Forms.module.css';
import ResultsExportModalStyles from 'src/styles/ResultsExportModal.module.css';
import { getURLForProductWithExistingParams } from 'src/utils';
import { getConfig } from 'src/utils/configRegistry';
import { getPreviewImageForProduct } from 'src/utils/endpoints';
import { getPropFromProduct } from 'src/utils/sharedUtils';
import { CheckIcon, CloseIcon } from './common/Icons';
import Select from './common/Select';

class ResultsExportModal extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      copied: false,
      exportOption: 'id',
    };
  }

  close = () => {
    this.props.close();
  };

  downloadResultsAsJson = () => {
    const config = getConfig();
    const exportName = `${config.app_title}_exported_metadata_${new Date().toJSON().slice(0, 10)}`;
    // Adapted from https://stackoverflow.com/a/30800715

    //
    const exportObj = this.props.results.map((result) => {
      // Exclude ASTRIA internal metadata
      const { _filenameDiff: _fd, _group: _grp, _backprojectPixelLoc: _bpl, ...obj } = result;

      // Add in additional metadata
      obj.additionalMetadata = {};

      // Preview image
      obj.additionalMetadata.previewImage = getPreviewImageForProduct(result);

      // App URL
      const newURL = getURLForProductWithExistingParams(obj);
      obj.additionalMetadata.appURL = newURL;

      return obj;
    });
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObj));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', exportName + '.json');
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };
  render() {
    const config = getConfig();
    const { copied, exportOption } = this.state;
    const { open, results } = this.props;

    const options = [
      { value: 'id', label: config.es_mappings.id.label },
      { value: 'filename', label: config.es_mappings.filename.label },
      { value: 'app_url', label: `${config.app_title} URL` },
      { value: 'preview', label: 'PNG/JPG Image URL' },
      { value: 'all', label: 'Search Metadata (JSON File)' },
    ];

    const selectedOption = options.filter((option) => option.value === exportOption);

    const modalClass = classNames({
      [alertStyles.alert]: true,
      [ResultsExportModalStyles.modal]: true,
    });

    const bodyClass = classNames({
      [alertStyles.message]: true,
      [ResultsExportModalStyles.body]: true,
    });

    const textareaClass = classNames({
      [FormsStyles.textarea]: true,
      [ResultsExportModalStyles.textarea]: true,
    });

    const textareaValue = results
      .map((r) => {
        if (exportOption === 'app_url') {
          return getURLForProductWithExistingParams(r);
        } else if (exportOption === 'preview') {
          return this.getPreviewImageForProduct(r);
        }
        return getPropFromProduct(r, config.es_mappings[exportOption]);
      })
      .join(',\n');
    const bulkDownloadMode = exportOption === 'all';

    return (
      <Modal
        overlayClassName={{
          base: alertStyles.overlayBase,
          afterOpen: alertStyles.afterOpen,
          beforeClose: alertStyles.beforeClose,
        }}
        className={modalClass}
        isOpen={open}
        onRequestClose={this.close}
      >
        <div className={alertStyles.headerContainer}>
          <div className={alertStyles.title}>Export Result List</div>
          <Button aria-label="Close" variant="icon" icon={<CloseIcon />} onClick={this.close} />
        </div>
        <div className={bodyClass}>
          Export the {results.length} currently loaded {results.length === 1 ? 'result' : 'results'} in a variety of
          modes. Note that the metadata available for download may be a subset of the full product metadata. Please
          refer to the original objects in OCS for the full metadata.
          <div className={ResultsExportModalStyles.exportSection}>
            <Select
              label="Metadata"
              labelPosition="top"
              defaultValue={selectedOption}
              searchable={false}
              options={options}
              onChange={(selectedOption) => this.setState({ exportOption: selectedOption.value })}
            />
            {!bulkDownloadMode && results.length > 0 && (
              <textarea className={textareaClass} readOnly value={textareaValue} />
            )}
            {bulkDownloadMode && (
              <Button variant="primary" text="Download Search Metadata" onClick={this.downloadResultsAsJson} />
            )}
          </div>
        </div>
        <div className={alertStyles.actionRow}>
          {copied && (
            <div className={FormsStyles.successMessage}>
              <CheckIcon />
              Copied
            </div>
          )}
          {!bulkDownloadMode && (
            <Button
              variant="secondary"
              text="Copy to Clipboard"
              onClick={() => {
                navigator.clipboard.writeText(textareaValue);
                this.setState({ copied: true });
                setTimeout(() => {
                  this.setState({ copied: false });
                }, 1500);
              }}
            />
          )}
          <Button variant="secondary" text="Close" onClick={this.close} />
        </div>
      </Modal>
    );
  }
}

ResultsExportModal.defaultProps = {
  results: [],
  open: false,
};

ResultsExportModal.propTypes = {
  results: PropTypes.array,
  open: PropTypes.bool,
};

export default ResultsExportModal;

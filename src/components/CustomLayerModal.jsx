import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import Modal from 'react-modal';
import Button from 'src/components/common/Button';
import alertStyles from 'src/styles/Alert.module.css';
import CustomLayerModalStyles from 'src/styles/CustomLayerModal.module.css';
import FormsStyles from 'src/styles/Forms.module.css';
import { getURLParams, objAlphaSort } from 'src/utils';
import { fetchESDataForProduct } from 'src/utils/dataQuery';
import { getPropFromProduct } from 'src/utils/sharedUtils';
import { CheckIcon, CloseIcon, WarningIcon } from './common/Icons';

import { getConfig } from 'src/utils/configRegistry';
class CustomLayerModal extends React.Component {
  constructor(props) {
    super(props);

    this.defaultState = {
      overlayPaths: '',
      checkingOverlays: false,
      overlaysAddSuccess: false,
      overlayCount: -1,
      error: '',
    };

    this.state = { ...this.defaultState };
  }

  addOverlays = async () => {
    const { overlayPaths } = this.state;

    this.setState({ checkingOverlays: true, overlaysAddSuccess: false, error: '', overlayCount: -1 });

    const paths = overlayPaths.split(',').map((x) => x.trim());
    try {
      const results = await Promise.allSettled(paths.map((p) => this.fetchOverlay(p)));
      if (results.find((result) => result.status === 'rejected')) {
        throw new Error('Unable to add overlay from path');
      }

      // Sort by filename
      objAlphaSort(
        results.map((r) => r.value),
        'ocs_name'
      ).forEach((overlay) => this.addOverlay(overlay));

      this.setState({
        checkingOverlays: false,
        overlaysAddSuccess: true,
        error: '',
        overlayCount: paths.length,
        overlayPaths: '',
      });
    } catch (err) {
      console.log(err);
      this.setState({
        checkingOverlays: false,
        overlaysAddSuccess: false,
        error: paths.length > 1 ? 'Unable to add all overlays' : 'Unable to add overlay',
      });
    }
  };

  fetchOverlay = (path) => {
    const config = getConfig();
    return new Promise(async (resolve, reject) => {
      try {
        let filename = '';
        let s3Path = '';

        // Determine if the path is an ASTRIA URL, an S3 path, or a filename
        if (path.indexOf(`${window.location.host}${window.location.pathname}`) === 0) {
          const parsed = getURLParams(path);
          let parsedOverlays = [];
          const parsedOverlaysValue = parsed[config.url_keys.overlays];
          if (parsedOverlaysValue) {
            if (typeof parsedOverlaysValue === 'string') parsedOverlays = [parsedOverlaysValue];
            else if (typeof parsedOverlaysValue === 'object') parsedOverlays = parsedOverlaysValue;
          }
          if (parsedOverlays.length > 0) {
            // TODO this all could really be a util..
            filename = parsedOverlays[0].split('(')[0]; // Handle case where overlay could have transformations
          } else if (parsed[config.url_keys.searchProduct]) {
            s3Path = parsed[config.url_keys.searchProduct];
          }
        } else if (path.indexOf('s3://') === 0) {
          s3Path = path;
        } else {
          // Assume the string is a filename
          filename = path;
        }

        // See if the product exists in groups
        const flatGroups = this.props.groups.flat();
        let matchingProduct = flatGroups.find((x) => {
          if (s3Path) return s3Path === getPropFromProduct(x, config.es_mappings.id);
          else return filename === getPropFromProduct(x, config.es_mappings.filename);
        });

        if (!matchingProduct) {
          // Look up the product in OCS
          const results = await fetchESDataForProduct(
            s3Path || filename,
            null,
            filename ? config.es_mappings.filename.key : '',
            10 // allow multiple results to catch any duplication
          );
          if (results.length) {
            // Use the product that matches the current bucket, otherwise use the first product
            const matchingProductByBucket = results.find(
              (product) =>
                getPropFromProduct(product, config.es_mappings.package_name) === this.props.ocsPackages.active
            );
            if (matchingProductByBucket) matchingProduct = matchingProductByBucket;
            else matchingProduct = results[0];
          } else {
            throw new Error('No results found');
          }
        }

        // Set custom flag on layer
        matchingProduct._isCustom = true;
        resolve(matchingProduct);
      } catch (err) {
        console.log(err);
        reject(err);
      }
    });
  };

  addOverlay(product) {
    this.props.addLayer(product);
  }

  close = () => {
    this.setState({ ...this.defaultState });
    this.props.close();
  };

  onKeyDown = (event) => {
    // fire our on change when we see enter key pressed
    if (event.keyCode === 13) {
      this.addOverlays();
    }
  };

  render() {
    const config = getConfig();
    const { overlayPaths, error, overlaysAddSuccess, checkingOverlays } = this.state;
    const { customLayerModalOpen } = this.props;

    const modalClass = classNames({
      [alertStyles.alert]: true,
      [CustomLayerModalStyles.modal]: true,
    });

    const bodyClass = classNames({
      [alertStyles.message]: true,
      [CustomLayerModalStyles.body]: true,
    });
    const inputContainerClasses = classNames({
      [FormsStyles.autosuggestInputContainer]: true,
      [FormsStyles.inputNormal]: true,
      [FormsStyles.iconRight]: true,
    });
    const inputClass = classNames({
      [FormsStyles.autosuggestInput]: true,
    });

    return (
      <Modal
        overlayClassName={{
          base: alertStyles.overlayBase,
          afterOpen: alertStyles.afterOpen,
          beforeClose: alertStyles.beforeClose,
        }}
        className={modalClass}
        isOpen={customLayerModalOpen}
        onRequestClose={this.close}
      >
        <div className={alertStyles.headerContainer}>
          <div className={alertStyles.title}>Add Layers from URL or Path</div>
          <Button aria-label="Close" variant="icon" icon={<CloseIcon />} onClick={this.close} />
        </div>
        <div className={bodyClass}>
          <div>
            Add image overlays from {config.app_title} URLs, S3 paths, and filenames. Multiple images should be
            separated by commas. The overlays do not have to be from the same image group as the base image however
            undesired results may occur if the dimensions of an overlay differ from those of the base image.
          </div>
          <div className={inputContainerClasses}>
            <input
              aria-label="Image paths"
              autoFocus
              disabled={checkingOverlays}
              className={inputClass}
              placeholder={`E.g. ${window.location.origin}${window.location.pathname}/?...`}
              type="string"
              value={overlayPaths}
              onChange={(evt) => this.setState({ overlayPaths: evt.target.value })}
              onKeyDown={this.onKeyDown}
            />
          </div>
        </div>
        <div className={alertStyles.actionRow}>
          {error && (
            <div className={FormsStyles.errorMessage}>
              <WarningIcon />
              {error}
            </div>
          )}
          {overlaysAddSuccess && (
            <div className={FormsStyles.successMessage}>
              <CheckIcon />
              Layers successfully added
            </div>
          )}
          <Button variant="secondary" text="Close" onClick={this.close} />
          <Button
            variant="primary"
            text="Add"
            disabled={checkingOverlays || !overlayPaths}
            onClick={this.addOverlays}
          />
        </div>
      </Modal>
    );
  }
}

CustomLayerModal.defaultProps = {
  customLayerModalOpen: false,
};

CustomLayerModal.propTypes = {
  customLayerModalOpen: PropTypes.bool,
  addLayer: PropTypes.func.isRequired,
  groups: PropTypes.array.isRequired,
  ocsPackages: PropTypes.object.isRequired,
};

export default CustomLayerModal;

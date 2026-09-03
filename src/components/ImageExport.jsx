import PropTypes from 'prop-types';
import React from 'react';
import Modal from 'react-modal';
import Button from 'src/components/common/Button';
import Checkbox from 'src/components/common/Checkbox';
import { CloseIcon, Download } from 'src/components/common/Icons';
import Select from 'src/components/common/Select';
import alertStyles from 'src/styles/Alert.module.css';
import TypographyStyles from 'src/styles/common/typography.module.css';
import ImageExportStyles from 'src/styles/ImageExport.module.css';

const EXPORT_RESOLUTIONS = [
  { label: 'Low', value: '1080' },
  { label: 'Medium', value: '2160' },
  { label: 'High', value: '4320' },
  { label: 'Actual', value: '-1' },
];
class ImageExport extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      preserve: false,
      drawings: true,
      measurements: true,
      targets: true,
      azElRulers: true,
      resolution: EXPORT_RESOLUTIONS[1],
      exportingModalOpen: false,
      exporting: false,
      exportingSuccess: false,
      exportProgress: { loaded: 0, needed: 0 },
    };
  }

  doPrimaryAction() {
    const { preserve, drawings, measurements, targets, azElRulers, resolution } = this.state;
    const { azElSupported } = this.props;
    this.setState({ exportingModalOpen: true, exporting: true, exportProgress: { loaded: 0, needed: 0 } });
    this.props.onClose();
    this.props.exportImage({
      bounds: preserve,
      drawings,
      measurements,
      targets,
      azElRulers: azElRulers && azElSupported,
      resolution: parseInt(resolution.value),
      download: true,
      progressCallback: (progress) => {
        this.setState({ exportProgress: progress });
      },
      callback: (success) => {
        this.setState({ exporting: false, exportingSuccess: success });
        if (success) {
          setTimeout(() => {
            this.setState({ exportingModalOpen: false });
          }, 1000);
        }
      },
    });
  }

  renderExportingContent() {
    const { exporting, exportingSuccess, exportProgress } = this.state;
    let title = `Generating Image... ${Math.round(
      Math.min(exportProgress.loaded / exportProgress.needed || 0, 1) * 100
    )}%`;
    let message = '';
    if (!exporting) {
      if (exportingSuccess) title = 'Done';
      else {
        message = 'Unable to generate image composite, please try again later.';
        title = 'Error';
      }
    }
    return (
      <>
        <div className={alertStyles.headerContainer}>
          <div className={alertStyles.title}>{title}</div>
        </div>
        {message && <div className={alertStyles.message}>{message}</div>}
        {!exporting && !exportingSuccess && (
          <div className={alertStyles.actionRow}>
            <Button variant="primary" text="Close" onClick={() => this.setState({ exportingModalOpen: false })} />
          </div>
        )}
      </>
    );
  }

  renderSubmitContent() {
    const { resolution, preserve, drawings, measurements, targets, azElRulers } = this.state;
    const { onClose, azElSupported, osdWrapper, openHelpArticle } = this.props;

    // pull base layer from the viewer
    const baseLayer =
      osdWrapper && osdWrapper.osdViewer.world.getItemCount() > 0 ? osdWrapper.osdViewer.world.getItemAt(0) : null;

    if (baseLayer) {
      const sizes = EXPORT_RESOLUTIONS.map((option) => {
        const newOption = { ...option };
        let resVal = parseInt(newOption.value);

        // get output size
        const { targetWidth, targetHeight, limitExceeded } = osdWrapper.calculateExportResolution(
          baseLayer,
          resVal,
          preserve
        );

        // update label with target sizing
        newOption.label = `${option.label} (${targetWidth}x${targetHeight})`;

        // note if this resolution is too big
        newOption.limitExceeded = limitExceeded;

        return newOption;
      });

      const selectedRes = sizes.find((option) => option.value === resolution.value);

      return (
        <>
          <div className={alertStyles.headerContainer}>
            <div className={alertStyles.title}>Image Export</div>
            <Button aria-label="Close" variant="icon" icon={<CloseIcon />} onClick={onClose} />
          </div>
          <div className={alertStyles.message}>
            Image Export creates a screenshot of the image you see in your browser. To download the original full
            resolution base image or any of the RDR overlays please use the Download
            <span className={alertStyles.messageIcon} style={{ marginLeft: '2px' }}>
              <Download />
            </span>
            functionality in the Image tab.&nbsp;
            <button
              type="button"
              onClick={() => openHelpArticle('view_image_data_and_metadata/image_export')}
              className={TypographyStyles.learnMoreNoMargin}
            >
              Learn More
            </button>
          </div>
          <br />
          <div>
            <div className={ImageExportStyles.exportOption}>
              <Select
                value={selectedRes}
                options={sizes}
                onChange={(value) => this.setState({ resolution: value })}
                searchable={false}
                label="Resolution"
              />
              {selectedRes.limitExceeded ? (
                <div className={alertStyles.message}>
                  WARNING: The target resolution exceeds browser limits and the export may fail.
                </div>
              ) : null}
            </div>
            <Checkbox
              checked={preserve}
              value="preserve"
              onChange={() => this.setState({ preserve: !preserve })}
              label="Preserve Image Zoom and Position"
            />
            <Checkbox
              checked={drawings}
              value="drawings"
              onChange={() => this.setState({ drawings: !drawings })}
              label="Include Drawings"
            />
            <Checkbox
              checked={measurements}
              value="measurements"
              onChange={() => this.setState({ measurements: !measurements })}
              label="Include Measurements"
            />
            <Checkbox
              checked={targets}
              value="targets"
              onChange={() => this.setState({ targets: !targets })}
              label="Include Targets"
            />
            <Checkbox
              checked={azElSupported && azElRulers}
              disabled={!azElSupported}
              value="azElRulers"
              onChange={() => this.setState({ azElRulers: !azElRulers })}
              label="Include Azimuth/Elevation Rulers"
            />
          </div>
          <div className={alertStyles.actionRow}>
            <Button variant="secondary" text="Cancel" onClick={onClose} />
            <Button variant="primary" text="Export" onClick={() => this.doPrimaryAction()} />
          </div>
        </>
      );
    }
  }

  render() {
    const { exportingModalOpen } = this.state;
    const { open, onClose } = this.props;

    const isOpen = open || exportingModalOpen;

    return (
      <Modal
        overlayClassName={{
          base: alertStyles.overlayBase,
          afterOpen: alertStyles.afterOpen,
          beforeClose: alertStyles.beforeClose,
        }}
        className={alertStyles.alert}
        isOpen={isOpen}
        onRequestClose={onClose}
        contentLabel="Image Export"
        shouldCloseOnOverlayClick={!exportingModalOpen}
        shouldCloseOnEsc={!exportingModalOpen}
      >
        {exportingModalOpen ? this.renderExportingContent() : this.renderSubmitContent()}
      </Modal>
    );
  }
}

ImageExport.defaultProps = {
  open: false,
  onClose: null,
  exportImage: null,
  openHelpArticle: () => {},
  azElSupported: false,
};

ImageExport.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  exportImage: PropTypes.func,
  azElSupported: PropTypes.bool,
  openHelpArticle: PropTypes.func,
};

export default ImageExport;

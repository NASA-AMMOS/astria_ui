import PropTypes from 'prop-types';
import React from 'react';
import SidebarOverlay from 'src/components/activeProduct/SidebarOverlay';
import Button from 'src/components/common/Button';
import { ExternalLink } from 'src/components/common/Icons';
import InlineLabeledValue from 'src/components/common/InlineLabeledValue';
import SelectedTargetMetadataStyles from 'src/styles/SelectedTargetMetadata.module.css';
import { formatTargetDate, getURLForProductWithExistingParams, openInNewTab } from 'src/utils';
import { getDisplayName } from 'src/utils/asttroLib/targetType';
import { fetchESDataForProduct } from 'src/utils/dataQuery';
import { ASTTROGetLinkForTarget, CAMPGetLinkForTarget } from 'src/utils/endpoints';
import { getShortTargetID } from 'src/utils/osd/osdUtils';
import { getPropFromProduct } from 'src/utils/sharedUtils';
import * as telemetry from 'src/utils/telemetryUtils';

import config from 'config.js';
class SelectedTargetMetadata extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      openingImage: false,
    };
  }

  handleClose = () => {
    this.props.setTargetMetadataOpen();
  };

  openTargetImage = async () => {
    const { selectedTarget } = this.props;
    this.setState({ openingImage: true });

    // Fetch product from OCS
    try {
      const product = await fetchESDataForProduct(
        selectedTarget.content.imageId + '.IMG', // ASTTRO imageId does not include IMG
        null,
        config.es_mappings.filename.key
      );
      this.setState({ openingImage: false });

      // Show only the selected target
      const urlParams = {};
      const targetsKey = config.url_keys.targets;
      urlParams[targetsKey] = getShortTargetID(selectedTarget.content.id);

      // Link to selected target
      const selectedTargetKey = config.url_keys.selectedTarget;
      urlParams[selectedTargetKey] = selectedTarget.content.id;

      // Add the current base image as an overlay since this is required for loading targets, can't just use base image
      const overlaysKey = config.url_keys.overlays;
      urlParams[overlaysKey] = getPropFromProduct(product, config.es_mappings.filename);

      openInNewTab(getURLForProductWithExistingParams(product, urlParams), false);
    } catch (err) {
      telemetry.logError('Unable to fetch target product from OCS', err);
      this.setState({ openingImage: false });
    }
  };

  render() {
    const { selectedTarget, zoomToTarget } = this.props;
    const { openingImage } = this.state;

    if (!selectedTarget) return <></>;

    const ij =
      typeof selectedTarget.content.i === 'number'
        ? `${selectedTarget.content.i.toFixed(3)}, ${selectedTarget.content.j.toFixed(3)}`
        : '';

    const pixelLocation =
      selectedTarget.pixelLocation &&
      selectedTarget.pixelLocation.pixel &&
      typeof selectedTarget.pixelLocation.pixel.x === 'number'
        ? `${selectedTarget.pixelLocation.pixel.y.toFixed(3)}, ${selectedTarget.pixelLocation.pixel.x.toFixed(3)}` // swap since we'll be calling this line/sample
        : '';

    const xyz =
      typeof selectedTarget.content.x === 'number'
        ? `${selectedTarget.content.x.toFixed(3)}, ${selectedTarget.content.y.toFixed(
            3
          )}, ${selectedTarget.content.z.toFixed(3)}`
        : '';

    const azEl =
      typeof selectedTarget.content.azimuth === 'number'
        ? `${selectedTarget.content.azimuth.toFixed(3)}, ${selectedTarget.content.elevation.toFixed(3)}`
        : '';

    const uvw =
      typeof selectedTarget.content.u === 'number'
        ? `${selectedTarget.content.u.toFixed(3)}, ${selectedTarget.content.v.toFixed(
            3
          )}, ${selectedTarget.content.w.toFixed(3)}`
        : '';

    const notes = selectedTarget.content.properties ? selectedTarget.content.properties.notes || 'No notes' : '';

    return (
      <SidebarOverlay label="Target Metadata Panel" isOpen={selectedTarget} handleClose={this.handleClose}>
        <div className={SelectedTargetMetadataStyles.root}>
          <div className={SelectedTargetMetadataStyles.header}>{selectedTarget.content.name}</div>
          <div className={SelectedTargetMetadataStyles.valuesContainer}>
            <InlineLabeledValue
              key="type"
              value={getDisplayName(selectedTarget.content.type)}
              label="Type"
              valueMissing={false}
            />
            <InlineLabeledValue
              key="owner"
              value={getDisplayName(selectedTarget.content.owner)}
              label="Owner"
              valueMissing={false}
            />
            {typeof selectedTarget.content.sol === 'string' && (
              <InlineLabeledValue key="sol" value={selectedTarget.content.sol} label="Sol" valueMissing={false} />
            )}
            <InlineLabeledValue
              key="dateCreated"
              value={selectedTarget.dbContent.creationDate && formatTargetDate(selectedTarget.dbContent.creationDate)}
              label="Date Created"
              valueMissing={!selectedTarget.dbContent.creationDate}
            />
            <InlineLabeledValue
              key="lastModified"
              value={selectedTarget.dbContent.updateDate && formatTargetDate(selectedTarget.dbContent.updateDate)}
              label="Last Modified"
              valueMissing={!selectedTarget.dbContent.updateDate}
            />
            <InlineLabeledValue key="UUID" value={selectedTarget.dbContent.uuid} label="UUID" valueMissing={false} />
            <InlineLabeledValue
              key="version"
              value={selectedTarget.dbContent.version}
              label="Version"
              valueMissing={false}
            />
            {ij && <InlineLabeledValue key="ij" value={ij} label="IJ" valueMissing={false} />}
            {pixelLocation && (
              <InlineLabeledValue
                key="pixelLocation"
                value={pixelLocation}
                label="Derived Line/Sample"
                valueMissing={false}
              />
            )}
            <InlineLabeledValue
              key="frame"
              value={selectedTarget.content.frame}
              label="Frame"
              valueMissing={!selectedTarget.content.frame}
            />
            <InlineLabeledValue
              key="rmc"
              value={selectedTarget.content.rmc}
              label="Site, Drive"
              valueMissing={!selectedTarget.content.rmc}
            />
            {xyz && <InlineLabeledValue key="xyz" value={xyz} label="XYZ" valueMissing={false} />}
            {azEl && <InlineLabeledValue key="azEl" value={azEl} label="Az/El (deg)" valueMissing={false} />}
            {uvw && <InlineLabeledValue key="uvw" value={uvw} label="UVW" valueMissing={false} />}
            <InlineLabeledValue key="notes" value={notes} label="Notes" valueMissing={!notes} />
            {selectedTarget.content.imageId && (
              <InlineLabeledValue
                key="image"
                value={
                  <Button
                    variant="text"
                    onClick={this.openTargetImage}
                    disabled={openingImage}
                    text={
                      <div className={SelectedTargetMetadataStyles.linkButton}>
                        {selectedTarget.content.imageId} <ExternalLink />
                      </div>
                    }
                  />
                }
                label="Image"
                valueMissing={false}
              />
            )}
            <InlineLabeledValue
              key="openInASTTRO"
              value={
                <Button
                  variant="text"
                  onClick={() => openInNewTab(ASTTROGetLinkForTarget(selectedTarget))}
                  text={
                    <div className={SelectedTargetMetadataStyles.linkButton}>
                      ASTTRO <ExternalLink />
                    </div>
                  }
                />
              }
              label="ASTTRO"
              valueMissing={false}
            />
            <InlineLabeledValue
              key="openInCAMP"
              value={
                <Button
                  variant="text"
                  onClick={() => openInNewTab(CAMPGetLinkForTarget(selectedTarget))}
                  text={
                    <div className={SelectedTargetMetadataStyles.linkButton}>
                      CAMP <ExternalLink />
                    </div>
                  }
                />
              }
              label="CAMP"
              valueMissing={false}
            />
          </div>
          <Button
            className={SelectedTargetMetadataStyles.findTargetButton}
            variant="secondary"
            text="Find Target"
            onClick={() => zoomToTarget(selectedTarget.content.id)}
          />
        </div>
      </SidebarOverlay>
    );
  }
}

SelectedTargetMetadata.defaultProps = {
  selectedTarget: null,
};

SelectedTargetMetadata.propTypes = {
  selectedTarget: PropTypes.object,
  zoomToTarget: PropTypes.func.isRequired,
};

export default SelectedTargetMetadata;

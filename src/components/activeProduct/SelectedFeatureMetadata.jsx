import PropTypes from 'prop-types';
import React from 'react';
import SidebarOverlay from 'src/components/activeProduct/SidebarOverlay';
import Button from 'src/components/common/Button';
import ImageResult from 'src/components/common/ImageResult';
import InlineLabeledValue from 'src/components/common/InlineLabeledValue';
import SelectedFeatureMetadataStyles from 'src/styles/SelectedFeatureMetadata.module.css';
import { getPropFromProduct } from 'src/utils/sharedUtils';

import config from 'config.js';
class SelectedFeatureMetadata extends React.Component {
  constructor(props) {
    super(props);

    this.state = {};
  }

  handleClose = () => {
    this.props.setFeatureMetadataOpen();
  };

  render() {
    const { selectedFeature, keywordsMap, zoomToFeature } = this.props;

    if (!selectedFeature) return null;

    const keywordName = keywordsMap[selectedFeature.feature_science_intent_keyword_id]
      ? keywordsMap[selectedFeature.feature_science_intent_keyword_id].name
      : `No Keyword Selected`;

    const baseId = getPropFromProduct(selectedFeature, config.es_mappings.image_feature.base_id);
    const confidenceLevel = getPropFromProduct(
      selectedFeature,
      config.es_mappings.image_feature.feature_confidence_level
    );
    const geometryStr = getPropFromProduct(selectedFeature, config.es_mappings.image_feature.feature_geometry);
    const instrumentId = getPropFromProduct(selectedFeature, config.es_mappings.instrument_id);
    const featureId = getPropFromProduct(selectedFeature, config.es_mappings.image_feature.feature_id);
    const sol = getPropFromProduct(selectedFeature, config.es_mappings.image_feature.time1);
    const creator = getPropFromProduct(selectedFeature, config.es_mappings.created_by);
    const dateCreated = getPropFromProduct(selectedFeature, config.es_mappings.created_at);
    const ocsURL = getPropFromProduct(selectedFeature, config.es_mappings.id);
    const notes = getPropFromProduct(selectedFeature, config.es_mappings.image_feature.feature_notes);

    return (
      <SidebarOverlay label="Feature Metadata Panel" isOpen={selectedFeature} handleClose={this.handleClose}>
        <div className={SelectedFeatureMetadataStyles.root}>
          <div className={SelectedFeatureMetadataStyles.header}>{keywordName}</div>
          <ImageResult className={SelectedFeatureMetadataStyles.image} product={selectedFeature} interactable={false} />
          <div className={SelectedFeatureMetadataStyles.valuesContainer}>
            <InlineLabeledValue key="sol" value={sol} label="Sol" valueMissing={false} />
            <InlineLabeledValue key="creator" value={creator} label="Creator" valueMissing={false} />
            <InlineLabeledValue key="confidenceLevel" value={confidenceLevel} label="Confidence" valueMissing={false} />
            <InlineLabeledValue key="dateCreated" value={dateCreated} label="Date Created" valueMissing={false} />
            <InlineLabeledValue key="featureId" value={featureId} label="Feature ID" valueMissing={false} />
            <InlineLabeledValue key="instrument" value={instrumentId} label="Instrument ID" valueMissing={false} />
            <InlineLabeledValue key="baseId" value={baseId} label="Base Image" valueMissing={false} />
            <InlineLabeledValue key="geometryStr" value={geometryStr} label="Feature Geometry" valueMissing={false} />
            <InlineLabeledValue key="ocsURL" value={ocsURL} label="OCS URL" valueMissing={false} />
            <InlineLabeledValue key="notes" value={notes} label="Notes" valueMissing={false} />
          </div>
          <Button
            className={SelectedFeatureMetadataStyles.findFeatureButton}
            variant="secondary"
            text="Find Feature"
            onClick={() => zoomToFeature(selectedFeature)}
          />
        </div>
      </SidebarOverlay>
    );
  }
}

SelectedFeatureMetadata.defaultProps = {
  selectedFeature: null,
};

SelectedFeatureMetadata.propTypes = {
  selectedFeature: PropTypes.object,
  zoomToFeature: PropTypes.func.isRequired,
  keywordsMap: PropTypes.object.isRequired,
};

export default SelectedFeatureMetadata;

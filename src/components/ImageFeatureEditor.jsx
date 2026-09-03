import axios from 'axios';
import classNames from 'classnames';
import { Field, Form, Formik } from 'formik';
import debounce from 'lodash.debounce';
// import 'pencil.svg';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import Modal from 'react-modal';
import SidebarOverlay from 'src/components/activeProduct/SidebarOverlay';
import Button from 'src/components/common/Button';
import { CrosshairsLooseIcon, EditIcon, TrashIcon } from 'src/components/common/Icons';
import MultiSelect from 'src/components/common/MultiSelect';
import Select from 'src/components/common/Select';
import Tooltip from 'src/components/common/Tooltip';
import alertStyles from 'src/styles/Alert.module.css';
import AnnotationEditorStyles from 'src/styles/AnnotationEditor.module.css';
import FormsStyles from 'src/styles/Forms.module.css';
import ImageFeatureEditorStyles from 'src/styles/ImageFeatureEditor.module.css';
import { genWKTString, openGenericEmail } from 'src/utils';
import { datadriveDeleteFile } from 'src/utils/endpoints';
import { getPropFromProduct } from 'src/utils/sharedUtils';
import * as telemetry from 'src/utils/telemetryUtils';
import urljoin from 'url-join';
import Tip from './common/Tip';

import config from 'config.js';
class ImageFeatureEditor extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      numFeaturesUploaded: 0,
      featuresToUpload: 0,
      uploading: false,
      uploadingSuccess: false,
      uploadProgress: 0,
      deleting: 0,
      deletionSuccess: false,
      deletionAttempted: false,
      selectedKeyword: null,
      confidenceLevel: null,
    };
    this.notesInputRef = React.createRef();
    this.debouncedNotesChange = debounce(this.handleNotesChange.bind(this), 150, {
      trailing: true,
    });
  }

  componentDidMount() {
    this.modalTargetEl = document.getElementById('genericModalPortalTarget');

    // Before tab unload (e.g. refresh or close) trigger our onBeforeUnload action
    // which will check for unsaved changes and open the native confirmation dialog if needed
    window.addEventListener('beforeunload', (e) => this.props.onBeforeUnload(e));

    document.addEventListener('keydown', this.handleKeydown);
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.osdWrapper && this.props.osdWrapper) {
      this.props.osdWrapper.on('imagefeatureremoved', () => this.forceUpdate());
    }

    // If the editor is opening, update confidence level and keywords based off active annotation values
    if (this.props.imageFeatureEditorOpen && !prevProps.imageFeatureEditorOpen) {
      const update = {
        confidenceLevel: this.props.activeAnnotation.feature_confidence_level,
      };
      if (this.props.activeAnnotation.feature_confidence_level) {
        this.props.osdWrapper.setActiveFeatureConfidenceLevel(this.props.activeAnnotation.feature_confidence_level);
      } else this.props.osdWrapper.resetActiveFeatureConfidenceLevel();

      const keyword = this.props.keywords.find(
        (keyword) => keyword.id === this.props.activeAnnotation.feature_science_intent_keyword_id
      );
      if (keyword) {
        update.selectedKeyword = { value: keyword.id, label: keyword.name };
        this.props.osdWrapper.setActiveFeatureLabel(keyword.name);
      } else this.props.osdWrapper.resetActiveFeatureLabel();

      this.setState(update);
    }
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeydown);
  }

  handleKeydown = (event) => {
    if (event.target.nodeName !== 'INPUT') {
      if (event.key === 'f' && !event.metaKey) {
        this.startMarkingArea();
      }
    }
  };

  startMarkingArea = () => {
    const { imageFeatureEditorOpen, interactionMode, setInteractionMode, activeAnnotation } = this.props;

    const activeFeatures = this.getActiveImageFeatures();
    if (
      imageFeatureEditorOpen && // only if we have an open editor
      (interactionMode === config.interaction_modes.view_only || interactionMode === config.interaction_modes.edit) && // only if we're not already marking
      (activeAnnotation.isLocal || activeFeatures.length === 0) // only if we're not adding a new area to an existing feature
    ) {
      setInteractionMode(config.interaction_modes.draw_image_feature);
    }
  };

  renderDrawingTools() {
    const { interactionMode, selectedShapes, osdWrapper, activeAnnotation } = this.props;
    const { selectedKeyword } = this.state;

    // generate some helpful drawing hints
    let hintText = 'Click a shape on the image to select it. Shift + Click to select multiple';
    if (typeof selectedShapes !== 'undefined' && selectedShapes.length === 1) {
      if (['polygon'].indexOf(selectedShapes[0].get('shapeType')) !== -1) {
        hintText += '. Double click the shape to edit points';
      }
    }

    if ([config.interaction_modes.draw_image_feature].indexOf(interactionMode) !== -1) {
      hintText = 'Click to add points, double-click to complete the shape, use alt/option to pan while drawing';
    }

    const activeFeatures = this.getActiveImageFeatures();

    let primaryButtonText = 'Cancel';
    if (interactionMode === config.interaction_modes.view_only || interactionMode === config.interaction_modes.edit) {
      primaryButtonText = (
        <span>
          Mark Area on Image <span className={ImageFeatureEditorStyles.buttonShortcut}>(f)</span>
        </span>
      );
    }

    return (
      <>
        <div className={ImageFeatureEditorStyles.inputGroup}>
          <div className={ImageFeatureEditorStyles.inputGroupLabel}>Feature Areas</div>
          <Button
            variant="secondary"
            text={primaryButtonText}
            onClick={() => {
              if (interactionMode === config.interaction_modes.draw_image_feature) {
                this.props.setInteractionMode(config.interaction_modes.edit);
              } else {
                this.startMarkingArea();
              }
            }}
            disabled={!activeAnnotation.isLocal && activeFeatures.length > 0}
          />
        </div>
        <Tip>{hintText}</Tip>
        {activeFeatures.length > 0 && (
          <div className={ImageFeatureEditorStyles.featureShapes}>
            {activeFeatures.map((feature, i) => {
              const featureId = feature.length > 0 ? feature[0].imageFeatureId : '';
              const isSelected = selectedShapes.find((s) => s.imageFeatureId === featureId);
              const onMouseEnter = () => osdWrapper.highlightFeature(featureId);
              const onMouseLeave = () => osdWrapper.unhighlightFeature(featureId);
              const featureClasses = classNames({
                [ImageFeatureEditorStyles.featureShape]: true,
                [ImageFeatureEditorStyles.featureShapeSelected]: isSelected,
              });
              return (
                <div key={featureId} className={featureClasses} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
                  {selectedKeyword ? selectedKeyword.label : 'Image Feature'} #{i + 1}
                  <div className={ImageFeatureEditorStyles.featureShapeButtons}>
                    <Tooltip overlay="Delete Feature" placement="top">
                      <Button
                        aria-label="Delete Feature"
                        variant="icon"
                        icon={<TrashIcon />}
                        onClick={() => this.handleRemoveGeometry(featureId)}
                      />
                    </Tooltip>
                    <Tooltip overlay="Select Feature" placement="topLeft">
                      <Button variant="icon" icon={<EditIcon />} onClick={() => osdWrapper.selectFeature(featureId)} />
                    </Tooltip>
                    <Tooltip overlay="Zoom to Feature" placement="topLeft">
                      <Button
                        aria-label="Zoom to Feature"
                        variant="icon"
                        icon={<CrosshairsLooseIcon />}
                        onClick={() => osdWrapper.zoomToFeature(featureId)}
                      />
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  }

  renderFeatureNotesEditor() {
    const featureNotes = this.props.activeAnnotation.feature_notes || '';
    const textAreaClasses = classNames({
      [AnnotationEditorStyles.textarea]: true,
      [FormsStyles.textarea]: true,
    });
    return (
      <div className={ImageFeatureEditorStyles.inputGroup}>
        <div className={ImageFeatureEditorStyles.inputGroupLabel}>Feature Notes</div>
        <Formik
          enableReinitialize
          initialValues={{ featureNotes }}
          onSubmit={(values, { setSubmitting }) => {
            this.debouncedNotesChange(values.featureNotes);
            setSubmitting(false);
          }}
        >
          {() => (
            <Form noValidate autoComplete="off">
              <Field name="featureNotes">
                {({ field }) => {
                  const { value, onChange, ...otherFieldProps } = field;
                  return (
                    <>
                      <textarea
                        aria-label="Feature notes"
                        ref={this.notesInputRef}
                        className={textAreaClasses}
                        value={value}
                        placeholder="Optionally add notes to this feature."
                        onChange={(e) => {
                          this.debouncedNotesChange(e.target.value);
                          onChange(e);
                        }}
                        {...otherFieldProps}
                      />
                    </>
                  );
                }}
              </Field>
            </Form>
          )}
        </Formik>
      </div>
    );
  }

  renderDeletionModal() {
    const { isDeleteModalOpen, deleting, deletionSuccess, deletionAttempted } = this.state;
    let deleteBtnText = '';
    if (deleting) deleteBtnText = 'Working...';
    else {
      if (deletionAttempted && !deletionSuccess) deleteBtnText = 'Retry';
      else deleteBtnText = 'Delete';
    }
    return (
      <Modal
        overlayClassName={{
          // TODO move these into a diff stylesheet, maybe abstract this into generic modal
          base: alertStyles.overlayBase,
          afterOpen: alertStyles.afterOpen,
          beforeClose: alertStyles.beforeClose,
        }}
        className={alertStyles.alert}
        isOpen={isDeleteModalOpen}
        onRequestClose={this.closeModal}
        shouldCloseOnOverlayClick={false}
        shouldCloseOnEsc={false}
      >
        <div className={alertStyles.headerContainer}>
          <div className={alertStyles.title}>Delete Drawing?</div>
        </div>
        <div className={alertStyles.message}>
          Are you sure you would like to delete this drawing? This action cannot be undone.
        </div>
        <div className={alertStyles.actionRow}>
          {!deleting && <Button variant="secondary" text="Cancel" onClick={this.closeModal} />}
          <Button variant="primary" disabled={deleting} text={deleteBtnText} onClick={() => this.handleDelete()} />
        </div>
      </Modal>
    );
  }

  renderSavingModal() {
    const { isSavingModalOpen, uploading, uploadingSuccess, numFeaturesUploaded, featuresToUpload } = this.state;
    let title = 'Saving feature...';
    let message = '';
    if (uploading) {
      if (featuresToUpload > 1) {
        title = `Saving feature ${numFeaturesUploaded + 1}/${featuresToUpload}...`;
      }
    } else {
      if (uploadingSuccess) title = 'Saved';
      else {
        message = `Unable to save ${featuresToUpload > 1 ? 'all features' : 'feature'}, please try again later`;
        title = 'Error';
      }
    }
    return (
      <Modal
        overlayClassName={{
          // TODO move these into a diff stylesheet, maybe abstract this into generic modal
          base: alertStyles.overlayBase,
          afterOpen: alertStyles.afterOpen,
          beforeClose: alertStyles.beforeClose,
        }}
        className={alertStyles.alert}
        isOpen={isSavingModalOpen}
        onRequestClose={this.closeModal}
        shouldCloseOnOverlayClick={false}
        shouldCloseOnEsc={false}
      >
        <div className={alertStyles.headerContainer}>
          <div className={alertStyles.title}>{title}</div>
        </div>
        {message && <div className={alertStyles.message}>{message}</div>}
        {!uploading && !uploadingSuccess && (
          <div className={alertStyles.actionRow}>
            <Button variant="primary" text="Close" onClick={() => this.setState({ isSavingModalOpen: false })} />
          </div>
        )}
      </Modal>
    );
  }

  closeModal = () => {
    this.setState({ isDeleteModalOpen: false });
  };

  handleClose = () => {
    const { osdWrapper } = this.props;

    if (osdWrapper) {
      osdWrapper.stopAnnotating();
      osdWrapper.clearSelection();
      osdWrapper.setNextFeatureId(false);
    }

    this.setState({ confidenceLevel: null, selectedKeyword: null });
    this.props.setImageFeatureEditorOpen(false);
  };

  handleDeleteButtonClick = () => {
    this.setState({ isDeleteModalOpen: true, deleting: false, deletionSuccess: false, deletionAttempted: false });
  };

  handleDelete = async () => {
    const { activeAnnotation } = this.props;

    const onSuccess = () => {
      this.props.removeAnnotation(activeAnnotation, false);
      this.props.locallyRemoveAnnotation(activeAnnotation);
      this.props.setImageFeatureEditorOpen(false);
      this.closeModal();
      this.setState({
        deleting: false,
        deletionSuccess: true,
        deletionAttempted: true,
        confidenceLevel: null,
        selectedKeyword: null,
      });
    };

    // If it's a local annotation (e.g. not stored in OCS yet)
    // we don't need to make the delete call
    if (activeAnnotation.isLocal) onSuccess();
    else {
      this.setState({ deleting: true, deletionSuccess: false, deletionAttempted: false });

      try {
        await datadriveDeleteFile(activeAnnotation.ocs_package_id, activeAnnotation.ocs_dataset_id);
        onSuccess();
      } catch (err) {
        this.setState({ deleting: false, deletionSuccess: false, deletionAttempted: true });
        telemetry.logError(
          `Unable to delete active feature file for annotation id: ${activeAnnotation.annotation_id}`,
          err
        );
      }
    }
  };

  handleNotesChange = (notes) => {
    const { activeAnnotation, updateFeature } = this.props;

    // Update feature in store
    updateFeature({
      ...activeAnnotation,
      feature_notes: notes,
    });
  };

  getCurrFeatureData() {
    const { osdWrapper, activeAnnotation } = this.props;
    const annotationJSON = osdWrapper.annotationToJSON(activeAnnotation.annotation_id, false);
    return { annotationJSON };
  }

  saveFeature(feature) {
    const { osdWrapper } = this.props;
    const { selectedKeyword, confidenceLevel } = this.state;
    return new Promise(async (resolve, reject) => {
      let featureId = 'Unknown';
      try {
        // Get representative featureId
        const featureId = feature.length > 0 ? feature[0].imageFeatureId : null;
        if (!featureId) return;

        // Generate thumbnail of the feature
        const { blob, fullFrameHeight, fullFrameWidth } = await osdWrapper.getImageFeatureImage(featureId, 720);

        // Save the feature to OCS
        const dirPath = this.getFeatureDir();
        const featureFilename = this.getSanitizedAnnotationId(featureId) + '.jpg';
        const { layers, activeAnnotation } = this.props;
        const baseImage = layers[0];
        const primaryPolygon = osdWrapper.getFeaturePrimaryPolygon(featureId);
        const { transformedLSPoints } = osdWrapper.getTransformedPolygonPoints(primaryPolygon);
        const geometry = genWKTString({
          coords: transformedLSPoints.map((p) => [p.sample, p.line]),
          forceCircle: true,
        });

        const metadata = {
          feature_schema_version: '1',
          time1: getPropFromProduct(baseImage, config.es_mappings.time1),
          feature_id: featureId,
          base_id: getPropFromProduct(baseImage, config.es_mappings.id),
          base_group_id: getPropFromProduct(baseImage, config.es_mappings.group_id),
          group_id: featureId,
          feature_science_intent_keyword_id: selectedKeyword.value,
          feature_confidence_level: confidenceLevel,
          feature_notes: activeAnnotation.feature_notes,
          overlay_id: getPropFromProduct(baseImage, config.es_mappings.overlay_id),
          feature_geometry: geometry,
          instrument_id: getPropFromProduct(baseImage, config.es_mappings.instrument_id),
          instrument_category: getPropFromProduct(baseImage, config.es_mappings.instrument_category),
          width: fullFrameWidth,
          height: fullFrameHeight,
        };

        const keyPath = `${dirPath}/${featureFilename}`.replace(/^\/+/g, ''); // remove leading slash
        const fileData = new FormData();
        fileData.append('pkg_id', config.image_feature_upload.pkg_id);
        fileData.append('ocs_path', dirPath);
        fileData.append('ocs_name', featureFilename);
        fileData.append('overwrite', true);
        fileData.append('metadata', JSON.stringify(metadata));
        fileData.append('object_type_name', config.image_feature_upload.object_type);
        fileData.append('s3_key', keyPath);
        fileData.append('s3_bucket', config.image_feature_upload.s3_bucket);
        fileData.append('file', blob);

        const response = await axios.post(config.api_endpoints.datadrive.middleware + `/api/UploadManual`, fileData, {
          withCredentials: true,
          // onUploadProgress: progressEvent => {
          //   this.setState({ uploadProgress: Math.round((progressEvent.loaded * 100) / progressEvent.total) });
          // },
        });

        resolve(response);
      } catch (err) {
        // TODO
        reject(`Unable to save feature: ${featureId}`);
      }
    });
  }

  handleSave = async () => {
    const { activeAnnotation, osdWrapper } = this.props;
    const activeAnnoOpacity = activeAnnotation.opacity;
    const activeAnnoIsLocal = activeAnnotation.isLocal;

    // Set loading and modal states
    this.setState({ uploading: true, uploadingSuccess: false, isSavingModalOpen: true });

    // Save each feature independently
    const activeFeatures = this.getActiveImageFeatures();
    this.setState({ featuresToUpload: activeFeatures.length });

    const responses = [];
    for (let i = 0; i < activeFeatures.length; i++) {
      const feature = activeFeatures[i];
      try {
        const res = await this.saveFeature(feature);
        responses.push(res);

        this.setState({ numFeaturesUploaded: this.state.numFeaturesUploaded + 1 });
      } catch (err) {
        // TODO what to do here?
        const featureId = feature.length > 0 ? feature[0].imageFeatureId : 'Unknown';
        telemetry.logError(`Unable to save feature with id: ${featureId}`, err);
        this.setState({ uploading: false, uploadingSuccess: false, numFeaturesUploaded: 0, featuresToUpload: 0 });
        return;
      }
    }

    // remove the current annotation which contains all of the individual feature shapes
    this.props.removeAnnotation(activeAnnotation, false);
    this.props.clearActiveAnnotation();
    osdWrapper.setNextFeatureId(false);

    // Create independent local annotations for each feature
    responses.forEach((res) => {
      // Construct OCS-like object to use as placeholder
      // for real one since we don't get the OCS object back
      // from DD and we want to use this object right away.

      // Also note that DD upload response uses keys that are diff
      // from what OCS uses for some strange reason.
      const annotationObj = {
        ...res.data.metadata,
        ocs_created_at: res.data.created_at,
        ocs_created_by: res.data.created_by,
        ocs_dataset_id: res.data.dataset_id,
        ocs_package_id: res.data.package_id,
        ocs_name: res.data.name,
        ocs_type_name: res.data.type_name,
        ocs_updated_at: res.data.updated_at,
        ocs_url: urljoin('s3://', res.data.s3_bucket, res.data.s3_key),
        isLocal: false,
        isUnsaved: false,
        opacity: activeAnnoOpacity,
        annotation_id: res.data.metadata.feature_id,
      };
      annotationObj.temp_ref = { ...annotationObj };

      if (!activeAnnoIsLocal) {
        // If the active feature annotation was a local one we can delete it
        // from groups since we'll be adding the proper one below
        this.props.locallyRemoveAnnotation(activeAnnotation);
      }
      this.props.locallyAddAnnotation(annotationObj);
      this.props.addImageFeatureAnnotationToDisplay(annotationObj);
    });

    this.setState({ uploading: false, uploadingSuccess: true, numFeaturesUploaded: 0, featuresToUpload: 0 });
    setTimeout(() => {
      this.setState({ isSavingModalOpen: false });
      // Finally close the feature editor since we potentially have multiple geometries that
      // now cannot be bulk edited.
      this.handleClose();
    }, 1000);
  };

  getSanitizedAnnotationId = (id) => {
    // Make annotation id filesystem safe by removing ".","/",":"
    return id.replaceAll('.', '').replaceAll('/', '').replaceAll(':', '');
  };

  getFeatureDir = () => {
    return `${config.image_feature_upload.ocs_path}image_features`;
  };

  createFeaturesDir = (path) => {
    const payload = {
      pkg_id: config.image_feature_upload.pkg_id,
      abs_path: path,
      s3_bucket: config.image_feature_upload.s3_bucket,
    };

    return axios.post(config.api_endpoints.datadrive.middleware + `/api/create_dir`, payload, {
      withCredentials: true,
    });
  };

  getActiveImageFeatures() {
    const { osdWrapper } = this.props;
    return osdWrapper ? osdWrapper.getActiveFeatures() : [];
  }

  onRequestNewFeature() {
    const message = "I'd like to request the addition of a new Science Intent Keyword: ";
    openGenericEmail({ subject: 'Request to Science Information Manager for New Science Intent Keyword', message });
  }

  handleRemoveGeometry(featureId) {
    const { osdWrapper } = this.props;

    // TODO - fix
    osdWrapper.removeImageFeature(featureId);
    const activeFeatures = osdWrapper.getActiveFeatures();

    // if this was the last feature, then re-use the last featureId to enable overwrites
    if (activeFeatures.length === 0) {
      osdWrapper.setNextFeatureId(featureId);
    }
  }

  render() {
    const { osdWrapper, imageFeatureEditorOpen, keywords, activeAnnotation, updateFeature } = this.props;
    const { uploading, selectedKeyword, confidenceLevel } = this.state;

    const activeFeatures = this.getActiveImageFeatures();
    const saveDisabled = uploading || !confidenceLevel || !selectedKeyword || activeFeatures.length < 1;

    const saveButtonWrapper = (children) => {
      if (saveDisabled) {
        return (
          <Tooltip overlay="Feature, area, and confidence level required" placement="top">
            <div className={AnnotationEditorStyles.saveButtonDisabledWrapper}>{children}</div>
          </Tooltip>
        );
      } else return children;
    };

    const keywordOptions = keywords.map((keyword) => ({ value: keyword.id, label: keyword.name }));

    return (
      <SidebarOverlay label="Feature Editor" isOpen={imageFeatureEditorOpen} handleClose={this.handleClose}>
        <div className={ImageFeatureEditorStyles.root}>
          <div className={AnnotationEditorStyles.compositingCanvas}>
            <img id="baseImage" alt="base" />
            <img id="annotationImage" alt="annotation" />
            <img id="finalImage" alt="final" />
            <canvas id="compositingCanvas" />
          </div>
          {this.modalTargetEl && ReactDOM.createPortal(this.renderDeletionModal(), this.modalTargetEl)}
          {this.modalTargetEl && ReactDOM.createPortal(this.renderSavingModal(), this.modalTargetEl)}
          <div className={ImageFeatureEditorStyles.body}>
            <div className={ImageFeatureEditorStyles.header}>
              <div className={ImageFeatureEditorStyles.title}>
                {activeAnnotation.isLocal ? 'Add Feature' : 'Edit Feature'}
              </div>
              <div className={ImageFeatureEditorStyles.subtitle}>
                {activeAnnotation.isLocal
                  ? 'Add a Feature and mark the areas on the image it appears in. All marked areas will share the same type, confidence level, and notes.'
                  : 'Edit feature type, confidence level, and notes.'}
              </div>
            </div>
            <div className={ImageFeatureEditorStyles.mainContent}>
              <Select
                labelWidth="100%"
                label={
                  <div className={ImageFeatureEditorStyles.featureSelectLabel}>
                    <span>Science Intent Keyword</span>
                    <Button variant="text" text="Request new keyword" onClick={this.onRequestNewFeature} />
                  </div>
                }
                placeholder="Select Science Intent Keyword"
                searchable
                value={selectedKeyword}
                options={keywordOptions}
                onChange={(selectedOption) => {
                  this.setState({ selectedKeyword: selectedOption });

                  // Set osdImageFeature internal label
                  osdWrapper.setActiveFeatureLabel(selectedOption.label);

                  // Set feature label for each feature
                  const activeFeatures = this.getActiveImageFeatures();
                  activeFeatures.forEach((feature) => {
                    const featureId = feature.length > 0 ? feature[0].imageFeatureId : null;
                    if (!featureId) return;
                    osdWrapper.setFeatureLabel(featureId, selectedOption.label);
                  });

                  // Update feature in store
                  updateFeature({
                    ...activeAnnotation,
                    feature_science_intent_keyword_id: selectedOption.value,
                  });
                }}
              />
              {this.renderDrawingTools()}
              <MultiSelect
                className={ImageFeatureEditorStyles.confidenceLevelMultiSelect}
                label="Confidence Level"
                selectedValue={confidenceLevel}
                options={[
                  { label: 'Low', value: config.image_feature_confidence_levels.low },
                  { label: 'Medium', value: config.image_feature_confidence_levels.medium },
                  { label: 'High', value: config.image_feature_confidence_levels.high },
                ]}
                onChange={(value) => {
                  this.setState({ confidenceLevel: value });

                  // Set osdImageFeature internal confidence level
                  osdWrapper.setActiveFeatureConfidenceLevel(value);

                  // Set confidence level for each feature
                  const activeFeatures = this.getActiveImageFeatures();
                  activeFeatures.forEach((feature) => {
                    const featureId = feature.length > 0 ? feature[0].imageFeatureId : null;
                    if (!featureId) return;
                    osdWrapper.setFeatureConfidenceLevel(featureId, value);
                  });

                  // Update feature in store
                  updateFeature({
                    ...activeAnnotation,
                    feature_confidence_level: value,
                  });
                }}
              />
              {this.renderFeatureNotesEditor()}
            </div>
          </div>
          <div className={ImageFeatureEditorStyles.footer}>
            {saveButtonWrapper(
              <Button
                full
                variant="primary"
                disabled={saveDisabled}
                text={uploading ? 'Saving...' : `Save Feature${activeFeatures.length > 1 ? 's' : ''}`}
                onClick={this.handleSave}
              />
            )}
            <Button
              full
              variant="secondary"
              disabled={uploading}
              text={`Delete Feature${activeFeatures.length > 1 ? 's' : ''}`}
              onClick={this.handleDeleteButtonClick}
              className={AnnotationEditorStyles.footerBtn}
            />
          </div>
        </div>
      </SidebarOverlay>
    );
  }
}

ImageFeatureEditor.defaultProps = {
  selectedShapes: [],
  osdWrapper: null,
  annotationEditorOpen: false,
  username: '',
  activeAnnotation: {},
};

ImageFeatureEditor.propTypes = {
  selectedShapes: PropTypes.arrayOf(PropTypes.object),
  username: PropTypes.string,
  osdWrapper: PropTypes.object,
  activeAnnotation: PropTypes.object,
  imageFeatureEditorOpen: PropTypes.bool,
  layers: PropTypes.arrayOf(PropTypes.object),
  setImageFeatureEditorOpen: PropTypes.func.isRequired,
  updateFeature: PropTypes.func.isRequired,
  startImageFeatureAnnotation: PropTypes.func.isRequired,
  setActiveAnnotation: PropTypes.func.isRequired,
  locallyUpdateAnnotation: PropTypes.func.isRequired,
  removeAnnotation: PropTypes.func.isRequired,
  setSavedAnnotationRef: PropTypes.func.isRequired,
  clearActiveAnnotation: PropTypes.func.isRequired,
  addImageFeatureAnnotationToDisplay: PropTypes.func.isRequired,
  onBeforeUnload: PropTypes.func.isRequired,
};

export default ImageFeatureEditor;

import axios from 'axios';
import classNames from 'classnames';
import { Field, Form, Formik } from 'formik';
import debounce from 'lodash.debounce';
// import 'pencil.svg';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import Modal from 'react-modal';
import sanitize from 'sanitize-filename';
import AnnotationShapeEditor from 'src/components/AnnotationShapeEditor';
import SidebarOverlay from 'src/components/activeProduct/SidebarOverlay';
import Button from 'src/components/common/Button';
import IconDropDown from 'src/components/common/IconDropDown';
import {
  ArrowLineIcon,
  CursorDefaultIcon,
  EllipseIcon,
  HelpIcon,
  LineIcon,
  PencilIcon,
  PolygonIcon,
  PolylineIcon,
  RectangleIcon,
  TextIcon,
} from 'src/components/common/Icons';
import Tooltip from 'src/components/common/Tooltip';
import alertStyles from 'src/styles/Alert.module.css';
import AnnotationEditorStyles from 'src/styles/AnnotationEditor.module.css';
import FormsStyles from 'src/styles/Forms.module.css';
import LayoutStyles from 'src/styles/common/layout.module.css';
import { arrayBufferToBase64, dataURItoBlob, performElasticSearchQuery } from 'src/utils';
import { buildTiledImageURL } from 'src/utils/osd/osdUtils';
import * as telemetry from 'src/utils/telemetryUtils';
import urlJoin from 'url-join';
import Toggle from './common/Toggle';

import { getConfig } from 'src/utils/configRegistry';
import { getPropFromProduct } from 'src/utils/sharedUtils';

const LOCALSTORAGE_BROWSE_GENERATION_KEY = 'enableAnnotationBrowseImageGeneration';
class AnnotationEditor extends React.Component {
  constructor(props) {
    super(props);

    const config = getConfig();
    this.selectTools = [
      {
        label: 'Select',
        value: config.interaction_modes.edit,
        category: 'select',
        icon: <CursorDefaultIcon />,
      },
    ];
    this.lineTools = [
      {
        label: 'Line',
        value: config.interaction_modes.draw_line,
        category: 'line',
        icon: <LineIcon />,
      },
      {
        label: 'Arrow',
        value: config.interaction_modes.draw_arrow,
        category: 'line',
        icon: <ArrowLineIcon />,
      },
      {
        label: 'Polyline',
        value: config.interaction_modes.draw_polyline,
        category: 'line',
        icon: <PolylineIcon />,
      },
    ];
    this.polygonTools = [
      {
        label: 'Polygon',
        value: config.interaction_modes.draw_polygon,
        category: 'polygon',
        icon: <PolygonIcon />,
      },
      {
        label: 'Rectangle',
        value: config.interaction_modes.draw_rect,
        category: 'polygon',
        icon: <RectangleIcon />,
      },
      {
        label: 'Ellipse',
        value: config.interaction_modes.draw_ellipse,
        category: 'polygon',
        icon: <EllipseIcon />,
      },
    ];
    this.specialTools = [
      {
        label: 'Pen',
        value: config.interaction_modes.draw_pen,
        category: 'special',
        icon: <PencilIcon />,
      },
    ];
    this.textTools = [
      {
        label: 'Text',
        value: config.interaction_modes.draw_text,
        category: 'text',
        icon: <TextIcon />,
      },
    ];

    this.state = {
      enableBrowseImageGeneration: localStorage.getItem(LOCALSTORAGE_BROWSE_GENERATION_KEY) === 'true' || false,
      currTools: {
        select: this.selectTools[0],
        line: this.lineTools[0],
        polygon: this.polygonTools[0],
        special: this.specialTools[0],
        text: this.textTools[0],
      },
      uploading: false,
      uploadingSuccess: false,
      uploadProgress: 0,
      // deleting: 0,
      // deletionSuccess: false,
      // deletionAttempted: false,
    };

    this.titleInputRef = React.createRef();
    this.descriptionInputRef = React.createRef();

    this.debouncedTitleChange = debounce(this.handleTitleChange.bind(this), 150, {
      trailing: true,
    });

    this.debouncedDescriptionChange = debounce(this.handleDescriptionChange.bind(this), 150, {
      trailing: true,
    });
  }

  componentDidMount() {
    this.modalTargetEl = document.getElementById('genericModalPortalTarget');

    // Before tab unload (e.g. refresh or close) trigger our onBeforeUnload action
    // which will check for unsaved changes and open the native confirmation dialog if needed
    window.addEventListener('beforeunload', (e) => this.props.onBeforeUnload(e));
  }

  componentDidUpdate(prevProps) {
    const { annotationEditorOpen } = this.props;

    // just opened
    if (annotationEditorOpen && !prevProps.annotationEditorOpen) {
      this.titleInputRef.current.focus();
    }
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

  renderToolList(tools) {
    return (
      <div className={AnnotationEditorStyles.toolMenu}>
        {tools.map((tool, i) => (
          <Button
            full
            key={`${tool.value}_${i}`}
            text={tool.label}
            variant="menuItem"
            icon={tool.icon}
            onClick={() => {
              this.handleActivateTool(tool, tool.category);
            }}
          />
        ))}
      </div>
    );
  }

  renderDrawingTools() {
    const config = getConfig();
    const { select, line, polygon, special, text } = this.state.currTools;
    const { interactionMode, selectedShapes } = this.props;

    // generate some helpful drawing hints
    let hintText = 'Click a shape on the image to select it. Shift + Click to select multiple';
    if (typeof selectedShapes !== 'undefined' && selectedShapes.length === 1) {
      if (['arrow', 'line', 'polyline', 'polygon'].indexOf(selectedShapes[0].get('shapeType')) !== -1) {
        hintText += '. Double click the shape to edit points';
      }
      if (['text', 'text-box'].indexOf(selectedShapes[0].get('shapeType')) !== -1) {
        hintText += '. Double click the shape to edit the text';
      }
    }

    if ([config.interaction_modes.draw_line, config.interaction_modes.draw_arrow].indexOf(interactionMode) !== -1) {
      hintText = 'Click two points to create shape';
    }
    if ([config.interaction_modes.draw_polyline].indexOf(interactionMode) !== -1) {
      hintText = 'Click to add points, double-click to complete the shape, use alt/option to pan while drawing';
    }
    if ([config.interaction_modes.draw_polygon].indexOf(interactionMode) !== -1) {
      hintText = 'Click to add points, double-click to complete the shape, use alt/option to pan while drawing';
    }
    if ([config.interaction_modes.draw_rect, config.interaction_modes.draw_ellipse].indexOf(interactionMode) !== -1) {
      hintText = 'Click to add shape, you can modify the size and shape after it is added';
    }
    if ([config.interaction_modes.draw_pen].indexOf(interactionMode) !== -1) {
      hintText = 'Click and drag to draw a path. Press ESC or switch to the select tool to finish';
    }
    if ([config.interaction_modes.draw_text].indexOf(interactionMode) !== -1) {
      hintText = 'Click to add placeholder text. You can edit the text after it is placed.';
    }

    return (
      <div className={AnnotationEditorStyles.toolbar}>
        <div className={AnnotationEditorStyles.editorLabel}>Drawing Tools</div>
        <div className={AnnotationEditorStyles.toolbarBtns}>
          <IconDropDown
            buttonTooltip={select.label}
            active={interactionMode === config.interaction_modes.edit}
            className={AnnotationEditorStyles.toolbarBtn}
            icon={select.icon}
            onClick={() => this.handleActivateTool(select, 'select')}
          />
          <IconDropDown
            buttonTooltip={line.label}
            menuTooltip={'Line Tools'}
            className={AnnotationEditorStyles.toolbarBtn}
            icon={line.icon}
            active={this.lineTools.map((tool) => tool.value).indexOf(interactionMode) !== -1}
            onClick={() => this.handleActivateTool(line, 'line')}
          >
            {this.renderToolList(this.lineTools)}
          </IconDropDown>
          <IconDropDown
            buttonTooltip={polygon.label}
            menuTooltip={'Shape Tools'}
            className={AnnotationEditorStyles.toolbarBtn}
            icon={polygon.icon}
            active={this.polygonTools.map((tool) => tool.value).indexOf(interactionMode) !== -1}
            onClick={() => this.handleActivateTool(polygon, 'polygon')}
          >
            {this.renderToolList(this.polygonTools)}
          </IconDropDown>
          <IconDropDown
            buttonTooltip={special.label}
            active={[config.interaction_modes.draw_pen].indexOf(interactionMode) !== -1}
            className={AnnotationEditorStyles.toolbarBtn}
            icon={special.icon}
            onClick={() => this.handleActivateTool(special, 'special')}
          />
          <IconDropDown
            buttonTooltip={text.label}
            className={AnnotationEditorStyles.toolbarBtn}
            icon={text.icon}
            active={[config.interaction_modes.draw_text].indexOf(interactionMode) !== -1}
            onClick={() => this.handleActivateTool(text, 'text')}
          />
        </div>
        <div className={AnnotationEditorStyles.drawingHint}>
          <HelpIcon />
          <div className={AnnotationEditorStyles.drawingHintText}>{hintText}</div>
        </div>
      </div>
    );
  }

  renderDrawingMetadataEditor() {
    const description = this.props.activeAnnotation.description || '';
    const textAreaClasses = classNames({
      [AnnotationEditorStyles.textarea]: true,
      [FormsStyles.textarea]: true,
    });
    return (
      <div className={AnnotationEditorStyles.editor}>
        <div className={AnnotationEditorStyles.editorLabel}>Drawing Metadata</div>
        <Formik
          enableReinitialize
          initialValues={{ description }}
          onSubmit={(values, { setSubmitting }) => {
            this.handleDescriptionChange(values.description);
            setSubmitting(false);
          }}
        >
          {() => (
            <Form noValidate autoComplete="off">
              <Field name="description">
                {({ field }) => {
                  const { value, onChange, ...otherFieldProps } = field;
                  return (
                    <>
                      <textarea
                        aria-label="Description"
                        ref={this.descriptionInputRef}
                        className={textAreaClasses}
                        value={value}
                        placeholder="Add a description..."
                        onChange={(e) => {
                          this.debouncedDescriptionChange(e.target.value);
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

  renderSavingModal() {
    const { isSavingModalOpen, uploading, uploadingSuccess } = this.state;
    let title = 'Saving drawing...';
    let message = '';
    if (!uploading) {
      if (uploadingSuccess) title = 'Saved';
      else {
        message = 'Unable to save drawing, please try again later';
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
    }
    this.props.setAnnotationEditorOpen(false);
  };

  handleTitleChange = (title) => {
    const { activeAnnotation } = this.props;
    this.props.updateAnnotation({ ...activeAnnotation, title });
  };

  handleDescriptionChange = (description) => {
    const { activeAnnotation } = this.props;
    this.props.updateAnnotation({ ...activeAnnotation, description });
  };

  handleActivateTool = (tool, category) => {
    this.setState({ currTools: { ...this.state.currTools, [category]: tool } });
    this.props.setInteractionMode(tool.value);
  };

  getCurrAnnotationData() {
    const { osdWrapper, activeAnnotation } = this.props;

    const { title, description } = activeAnnotation;
    const annotationJSON = osdWrapper.annotationToJSON(activeAnnotation.annotation_id, false);

    return {
      title,
      description,
      annotationJSON,
    };
  }

  getBrowseImageFilename() {
    return sanitize(`${this.props.activeAnnotation.title}_browse.jpg`);
  }

  async generateBrowseImage() {
    const config = getConfig();
    const { layers, osdWrapper, activeAnnotation } = this.props;
    if (layers.length < 1) return { image: null, width: 0, height: 0, error: 'Unable to generate browse image' };

    const baseImage = layers[0];
    const baseSize = osdWrapper.getLayerById(getPropFromProduct(baseImage, config.es_mappings.id)).getContentSize();

    // Compute a reasonable resolution, cap it at high res
    let resolution = config.annotation_upload.max_export_resolution || 4320;
    if (baseSize.x < resolution && baseSize.y < resolution) {
      // If the image size is small than our max resolution we can use the actual image size
      resolution = -1;
    }

    return new Promise((resolve) => {
      // Generate browse image of medium quality
      this.props.exportImage({
        drawings: true,
        measurements: false,
        targets: false,
        azElRulers: false,
        resolution,
        download: false,
        layerFilter: (l) => {
          if (l.annotationId) {
            return l.annotationId === activeAnnotation.annotation_id;
          } else return true;
        },
        callback: (metadata) => {
          if (metadata) {
            resolve({ image: metadata.blob, width: metadata.fullFrameWidth, height: metadata.fullFrameHeight });
          } else {
            // We'll resolve here instead of rejecting so that this function can be consumed without
            // wrapping it in a try/catch
            resolve({ image: null, width: 0, height: 0, error: 'Unable to generate browse image' });
          }
        },
      });
    });
  }

  async generateThumbnail() {
    const config = getConfig();
    const { osdWrapper, layers, activeAnnotation } = this.props;

    // Get base layer
    if (layers.length < 1) {
      return {
        thumbnail: null,
        width: 0,
        height: 0,
        error: 'No base image found and is required for thumbnail generation',
      };
    }

    // Get refs to our compositing elements
    const compositingCanvas = document.getElementById('compositingCanvas');
    const baseImageEl = document.getElementById('baseImage');
    const annotationImageEl = document.getElementById('annotationImage');
    const finalImageEl = document.getElementById('finalImage');
    const ctx = compositingCanvas.getContext('2d');

    const baseImage = layers[0];
    const baseSize = osdWrapper.getLayerById(getPropFromProduct(baseImage, config.es_mappings.id)).getContentSize();

    const url = buildTiledImageURL(baseImage, true);

    const options = {
      method: 'GET',
      mode: 'cors',
      credentials: 'include',
      cache: 'default',
    };
    const request = new Request(url);

    // fetch the image and then convert to base 64. We do this instead of
    // loading this in an img element in order to avoid CORS canvas issues later.
    let imageFetchResponse;
    try {
      imageFetchResponse = await fetch(request, options);
    } catch (_err) {
      return { thumbnail: null, width: 0, height: 0, error: 'Base image fetch failed during thumbnail generation' };
    }

    // Ensure status of response is ok, image tiling could have failed
    if (!imageFetchResponse.ok) {
      return { thumbnail: null, width: 0, height: 0, error: 'Bad image tiling response during thumbnail generation' };
    }

    const imageArrayBuffer = await imageFetchResponse.arrayBuffer();
    const base64Flag = 'data:image/jpeg;base64,';
    const imageStr = arrayBufferToBase64(imageArrayBuffer);
    baseImageEl.src = base64Flag + imageStr;

    return new Promise((resolve) => {
      baseImageEl.onload = () => {
        const targetWidth = baseImageEl.naturalWidth;
        const targetHeight = baseImageEl.naturalHeight;

        // resize everything for thumbnail
        compositingCanvas.width = targetWidth;
        compositingCanvas.height = targetHeight;
        baseImageEl.style.width = `${targetWidth}px`;
        baseImageEl.style.height = `${targetHeight}px`;
        annotationImageEl.style.width = `${targetWidth}px`;
        annotationImageEl.style.height = `${targetHeight}px`;
        finalImageEl.style.width = `${targetWidth}px`;
        finalImageEl.style.height = `${targetHeight}px`;

        // clear any previous thumbnails and add the new base image
        ctx.clearRect(0, 0, compositingCanvas.width, compositingCanvas.height);
        ctx.drawImage(baseImageEl, 0, 0, targetWidth, targetHeight);

        // generate the annotation image data and composite the thumbnail
        const scale = targetWidth / baseSize.x;
        osdWrapper
          .generateAnnotationImage(activeAnnotation.annotation_id, targetWidth, targetHeight, scale, Math.max(scale, 1))
          .then((annotation) => {
            ctx.drawImage(annotation, 0, 0, targetWidth, targetHeight);
            var img = compositingCanvas.toDataURL('image/png');
            annotationImageEl.src = annotation.src;
            finalImageEl.src = img;
            const thumbnail = dataURItoBlob(img);

            resolve({ thumbnail, targetWidth, targetHeight });
          })
          .catch((err) => {
            // We'll resolve here instead of rejecting so that this function can be consumed without
            // wrapping it in a try/catch
            resolve({ thumbnail: null, width: 0, height: 0, error: err });
          });
      };
    });
  }

  uploadImageToOCS = (file, filename, width, height) => {
    const config = getConfig();
    const metadata = {
      width: width,
      height: height,
      lossless: false,
    };

    const dirPath = this.getAnnotationDir();
    const keyPath = `${dirPath}/${filename}`.replace(/^\/+/g, ''); // remove leading slash

    const fileData = new FormData();
    fileData.append('pkg_id', config.annotation_upload.pkg_id);
    fileData.append('ocs_path', dirPath);
    fileData.append('ocs_name', filename);
    fileData.append('overwrite', true);
    fileData.append('metadata', JSON.stringify(metadata));
    fileData.append('object_type_name', 'm20-image');
    fileData.append('s3_key', keyPath);
    fileData.append('s3_bucket', config.annotation_upload.s3_bucket);
    fileData.append('file', file);

    return axios.post(config.api_endpoints.datadrive.middleware + `/api/UploadManual`, fileData, {
      withCredentials: true,
    });
  };

  handleSave = async () => {
    const config = getConfig();
    const { activeAnnotation } = this.props;
    const { enableBrowseImageGeneration } = this.state;

    const { title: annoTitle, description: annoDesc, annotationJSON } = this.getCurrAnnotationData();
    const title = this.titleInputRef.current ? this.titleInputRef.current.value : annoTitle;
    const description = this.descriptionInputRef.current ? this.descriptionInputRef.current.value : annoDesc;

    // Set loading and modal states
    this.setState({ uploading: true, uploadingSuccess: false, isSavingModalOpen: true });

    // create a directory to save everything to if the annotation has never been saved before (e.g. isLocal)
    const dirPath = this.getAnnotationDir();
    if (activeAnnotation.isLocal) {
      if (!getPropFromProduct(activeAnnotation, config.es_mappings.path)) {
        try {
          await this.createAnnotationDir(dirPath);
        } catch (err) {
          telemetry.logError(`Failed to create directory for annotation: ${activeAnnotation.annotation_id}`, err);
        }
      }
    }

    // Generate thumbnail
    let thumbnailS3URL;
    const promises = [];
    try {
      const { thumbnail, width, height, error } = await this.generateThumbnail();
      if (error) throw Error(error);
      const thumbnailFilename = this.getSanitizedAnnotationId(activeAnnotation.annotation_id) + '.jpg';
      thumbnailS3URL = urlJoin('s3://', config.annotation_upload.s3_bucket, dirPath, thumbnailFilename);
      promises.push(this.uploadImageToOCS(thumbnail, thumbnailFilename, width, height));
    } catch (err) {
      telemetry.logError(`Failed to generate thumbnail for annotation: ${activeAnnotation.annotation_id}`, err);
    }

    // Generate browse image if needed
    let browseImageS3URL;
    if (enableBrowseImageGeneration) {
      try {
        const { image, width, height, error } = await this.generateBrowseImage();
        if (error) throw Error(error);
        const browseImageFilename = this.getBrowseImageFilename();
        browseImageS3URL = urlJoin('s3://', config.annotation_upload.s3_bucket, dirPath, browseImageFilename);
        promises.push(this.uploadImageToOCS(image, browseImageFilename, width, height));
      } catch (err) {
        telemetry.logError(`Failed to generate browse image for annotation: ${activeAnnotation.annotation_id}`, err);
      }
    }

    // Push the json promise to the front so we always know it is the first promise
    promises.unshift(this.uploadJsonToOCS(title, description, annotationJSON, thumbnailS3URL, browseImageS3URL));

    // Upload JSON annotation, thumbnail, and browse image to OCS simultaneously
    Promise.all(promises)
      .then((results) => {
        const res = results[0]; // grab response from the JSON upload

        // Construct OCS-like object to use as placeholder
        // for real one since we don't get the OCS object back
        // from DD and we want to use this object right away.

        // Also note that DD upload response uses keys that are diff
        // from what OCS uses for some strange reason.
        const annotationObj = {
          ...res.data.metadata,
          // add a meaningless query string on the end so that react detects the new string and refetches the image
          // This should have no affect on the actual request
          thumbnail: thumbnailS3URL ? thumbnailS3URL + '?' + Date.now() : '',
          ocs_created_at: res.data.created_at,
          ocs_created_by: res.data.created_by,
          ocs_dataset_id: res.data.dataset_id,
          ocs_package_id: res.data.package_id,
          ocs_name: res.data.name,
          ocs_type_name: res.data.type_name,
          ocs_updated_at: res.data.updated_at,
          ocs_url: urlJoin('s3://', res.data.s3_bucket, res.data.s3_key),
          isLocal: false,
          isUnsaved: false,
          opacity: activeAnnotation.opacity,
        };
        annotationObj.temp_ref = { ...annotationObj };

        if (activeAnnotation.isLocal) {
          // If the active annotation was a local one we can delete it
          // from groups since we'll be adding the proper one below
          this.props.locallyRemoveAnnotation(activeAnnotation);
          this.props.locallyAddAnnotation(annotationObj);
        } else {
          this.props.locallyUpdateAnnotation(annotationObj);
        }

        this.props.setSavedAnnotationRef({
          title,
          description,
          annotationJSON,
          id: res.data.annotation_id,
        });

        // Update state with new object
        this.props.updateAnnotation(annotationObj);

        this.setState({ uploading: false, uploadingSuccess: true });
        setTimeout(() => {
          this.setState({ isSavingModalOpen: false });
        }, 1000);
      })
      .catch((err) => {
        telemetry.logError(`Unable to save active annotation annotation id: ${activeAnnotation.annotation_id}`, err);
        this.setState({ uploading: false, uploadingSuccess: false });
      });
  };

  uploadJsonToOCS = async (title, description, annotationJSON, thumbnailFilename, browseImageFilename) => {
    const config = getConfig();
    const { layers, activeAnnotation, osdWrapper } = this.props;
    const baseImage = layers[0];
    const dirPath = this.getAnnotationDir();

    const text = osdWrapper.getAnnotationText(activeAnnotation.annotation_id);

    const metadata = {
      title: title,
      description: description,
      time1: getPropFromProduct(baseImage, config.es_mappings.time1),
      thumbnail: thumbnailFilename,
      browse_image: browseImageFilename,
      annotation_id: activeAnnotation.annotation_id,
      base_id: getPropFromProduct(baseImage, config.es_mappings.id),
      base_group_id: getPropFromProduct(baseImage, config.es_mappings.group_id),
      group_id: activeAnnotation.annotation_id,
      overlay_id: getPropFromProduct(baseImage, config.es_mappings.overlay_id),
      annotation_schema_version: '2',
      text: text,
    };

    let filename = sanitize(`${title}.json`);
    if (
      getPropFromProduct(activeAnnotation, config.es_mappings.filename) &&
      getPropFromProduct(activeAnnotation, config.es_mappings.filename) !== filename
    ) {
      // rename/move the anno file first
      const renameData = {
        src_id: getPropFromProduct(activeAnnotation, config.es_mappings.dataset_id),
        src_pkg_id: config.annotation_upload.pkg_id,
        dest_pkg_id: config.annotation_upload.pkg_id,
        dest_path: dirPath,
        dest_name: filename,
      };

      await axios.post(config.api_endpoints.datadrive.middleware + `/api/move/item`, renameData, {
        withCredentials: true,
      });
    }

    const annotationJSONString = JSON.stringify(annotationJSON);
    const fileToUpload = new File([annotationJSONString], filename);

    const keyPath = `${dirPath}/${filename}`.replace(/^\/+/g, ''); // remove leading slash

    const fileData = new FormData();
    fileData.append('pkg_id', config.annotation_upload.pkg_id);
    fileData.append('ocs_path', dirPath);
    fileData.append('ocs_name', filename);
    fileData.append('overwrite', true);
    fileData.append('metadata', JSON.stringify(metadata));
    fileData.append('object_type_name', config.annotation_upload.object_type);
    fileData.append('s3_key', keyPath);
    fileData.append('s3_bucket', config.annotation_upload.s3_bucket);
    fileData.append('file', fileToUpload);

    return axios.post(config.api_endpoints.datadrive.middleware + `/api/UploadManual`, fileData, {
      withCredentials: true,
      // onUploadProgress: progressEvent => {
      //   this.setState({ uploadProgress: Math.round((progressEvent.loaded * 100) / progressEvent.total) });
      // },
    });
  };

  getSanitizedAnnotationId = (id = '') => {
    // Make annotation id filesystem safe by removing ".","/",":"
    return id.replaceAll('.', '').replaceAll('/', '').replaceAll(':', '');
  };

  getAnnotationDir = () => {
    const { activeAnnotation } = this.props;
    return `${getConfig().annotation_upload.ocs_path}${this.getSanitizedAnnotationId(activeAnnotation.annotation_id)}`;
  };

  createAnnotationDir = (path) => {
    const config = getConfig();
    const payload = {
      pkg_id: config.annotation_upload.pkg_id,
      abs_path: path,
      s3_bucket: config.annotation_upload.s3_bucket,
    };

    return axios.post(config.api_endpoints.datadrive.middleware + `/api/create_dir`, payload, {
      withCredentials: true,
    });
  };

  render() {
    const config = getConfig();
    const { osdWrapper, selectedShapes, activeAnnotation, annotationEditorOpen } = this.props;
    const { uploading, enableBrowseImageGeneration } = this.state;
    const title = activeAnnotation.title || '';

    const browseImageOCSPath = urlJoin(
      config.annotation_upload.s3_bucket,
      this.getAnnotationDir(),
      this.getBrowseImageFilename()
    );

    const saveButtonWrapper = (children) => {
      if (!title) {
        return (
          <Tooltip overlay="Title required" placement="top">
            <div className={AnnotationEditorStyles.saveButtonDisabledWrapper}>{children}</div>
          </Tooltip>
        );
      } else return children;
    };

    return (
      <SidebarOverlay label="Close Drawing Editor" isOpen={annotationEditorOpen} handleClose={this.handleClose}>
        <div className={AnnotationEditorStyles.compositingCanvas}>
          <img id="baseImage" alt="base" />
          <img id="annotationImage" alt="annotation" />
          <img id="finalImage" alt="final" />
          <canvas id="compositingCanvas" />
        </div>
        {this.modalTargetEl && ReactDOM.createPortal(this.renderSavingModal(), this.modalTargetEl)}

        <div className={AnnotationEditorStyles.title}>
          <Formik
            enableReinitialize
            initialValues={{ title }}
            onSubmit={(values, { setSubmitting }) => {
              this.handleTitleChange(values.title);
              setSubmitting(false);
            }}
          >
            {() => (
              <Form noValidate autoComplete="off">
                <Field name="title">
                  {({ field }) => {
                    const { value, onChange, ...otherFieldProps } = field;
                    return (
                      <div className={FormsStyles.textInputContainer}>
                        <input
                          aria-label="Drawing title"
                          ref={this.titleInputRef}
                          type="text"
                          placeholder="Title your drawing..."
                          className={AnnotationEditorStyles.inputLarge}
                          value={value}
                          onChange={(e) => {
                            this.debouncedTitleChange(e.target.value);
                            onChange(e);
                          }}
                          {...otherFieldProps}
                        />
                      </div>
                    );
                  }}
                </Field>
              </Form>
            )}
          </Formik>
        </div>
        {this.renderDrawingTools()}
        <div className={LayoutStyles.divider} />
        <div className={AnnotationEditorStyles.propertiesEditor}>
          {!selectedShapes.length && this.renderDrawingMetadataEditor()}
          <AnnotationShapeEditor
            selectedShapes={selectedShapes.length && !selectedShapes[0].get('disableShapeEdit') ? selectedShapes : []}
            osdWrapper={osdWrapper}
            activeAnnotation={activeAnnotation}
            isEditing={annotationEditorOpen}
          />
        </div>
        <div className={AnnotationEditorStyles.footer}>
          {enableBrowseImageGeneration && (
            <div className={AnnotationEditorStyles.browseImageExportPath}>Path: {browseImageOCSPath}</div>
          )}
          <div>
            <Toggle
              on={enableBrowseImageGeneration}
              label="Export a high resolution image to OCS"
              onChange={() => {
                this.setState({ enableBrowseImageGeneration: !enableBrowseImageGeneration });
                localStorage.setItem(LOCALSTORAGE_BROWSE_GENERATION_KEY, !enableBrowseImageGeneration);
              }}
            />
          </div>
          {saveButtonWrapper(
            <Button
              full
              variant="primary"
              disabled={uploading || !title}
              text={uploading ? 'Saving...' : 'Save Drawing'}
              onClick={this.handleSave}
              className={AnnotationEditorStyles.footerBtn}
            />
          )}
        </div>
      </SidebarOverlay>
    );
  }
}

AnnotationEditor.defaultProps = {
  selectedShapes: [],
  osdWrapper: null,
  annotationEditorOpen: false,
  username: '',
};

AnnotationEditor.propTypes = {
  selectedShapes: PropTypes.arrayOf(PropTypes.object),
  username: PropTypes.string,
  osdWrapper: PropTypes.object,
  annotationEditorOpen: PropTypes.bool,
  layers: PropTypes.arrayOf(PropTypes.object),
  setAnnotationEditorOpen: PropTypes.func.isRequired,
  setInteractionMode: PropTypes.func.isRequired,
  setActiveAnnotation: PropTypes.func.isRequired,
  locallyUpdateAnnotation: PropTypes.func.isRequired,
  removeAnnotation: PropTypes.func.isRequired,
  setSavedAnnotationRef: PropTypes.func.isRequired,
  onBeforeUnload: PropTypes.func.isRequired,
};

export default AnnotationEditor;

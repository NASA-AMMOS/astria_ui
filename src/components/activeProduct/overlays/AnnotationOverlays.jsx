import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import { ImageOverlay } from 'src/components/activeProduct/ImageOverlay';
import Button from 'src/components/common/Button';
import EmptyState from 'src/components/common/EmptyState';
import {
  CheckIcon,
  CrosshairsLooseIcon,
  EditIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
} from 'src/components/common/Icons';
import Tooltip from 'src/components/common/Tooltip';
import annotationFallbackImage from 'src/images/annotation_fallback_image.jpg';
import ImageOverlayStyles from 'src/styles/ImageOverlay.module.css';
import OverlaysPanelStyles from 'src/styles/OverlaysPanel.module.css';
import { formatDate } from 'src/utils';
import { datadriveGetOCSObjectDownloadPathForS3URL } from 'src/utils/endpoints';
import { getPropFromProduct } from 'src/utils/sharedUtils';

import config from 'config.js';
class AnnotationOverlays extends React.Component {
  handleDeleteButtonClick = (annotation) => {
    this.props.handleAnnotationDelete(annotation);
  };

  renderAvailableAnnotationResult = (annotation, annotationActive, loading) => {
    const {
      user,
      handleAnnotationAdd,
      handleAnnotationEdit,
      handleAnnotationRemove,
      handleAnnotationChangeOpacity,
      handleZoomToAnnotation,
    } = this.props;

    const annotationOwner = getPropFromProduct(annotation, config.es_mappings.created_by);
    let description = '';
    // TODO stop duplicating this code
    if (annotation.isLocal) {
      description = (
        <span>
          {annotationOwner} • <span className={OverlaysPanelStyles.overlayChip}>Unpublished</span>
        </span>
      );
    } else if (annotation.isUnsaved) {
      description = (
        <span>
          {annotationOwner} • <span className={OverlaysPanelStyles.overlayChip}>Unsaved</span>
        </span>
      );
    } else {
      const time =
        getPropFromProduct(annotation, config.es_mappings.updated_at) ||
        getPropFromProduct(annotation, config.es_mappings.created_at);
      const annotationLastUpdatedLocal = formatDate(time);
      const annotationLastUpdatedUTC = formatDate(time, true);
      const annotationLastUpdatedEl = (
        <Tooltip overlay={annotationLastUpdatedUTC} placement="top">
          <span className={OverlaysPanelStyles.annotationDate}>{annotationLastUpdatedLocal}</span>
        </Tooltip>
      );
      description = (
        <span>
          {annotationOwner} • {annotationLastUpdatedEl}
        </span>
      );
    }

    const annotationActions = (
      <>
        {user.username === annotationOwner && (
          <Tooltip overlay="Edit Drawing" placement="top">
            <Button
              aria-label="Edit Drawing"
              variant="icon"
              onClick={(evt) => {
                evt.stopPropagation();
                handleAnnotationEdit(annotation);
              }}
              icon={<EditIcon />}
            />
          </Tooltip>
        )}
        {user.username === annotationOwner && (
          <Tooltip overlay="Delete Drawing" placement="top">
            <Button
              aria-label="Delete Drawing"
              variant="icon"
              onClick={(evt) => {
                evt.stopPropagation();
                this.handleDeleteButtonClick(annotation);
              }}
              icon={<TrashIcon />}
            />
          </Tooltip>
        )}
        {!annotationActive && (
          <Tooltip overlay="Add Drawing" placement="top">
            <Button
              aria-label="Add Drawing"
              variant="icon"
              onClick={(evt) => {
                evt.stopPropagation();
                handleAnnotationAdd(annotation);
              }}
              icon={<PlusIcon />}
            />
          </Tooltip>
        )}
        {annotationActive && (
          <Tooltip overlay="Zoom to Drawing" placement="top">
            <Button
              aria-label="Zoom to Drawing"
              variant="icon"
              onClick={(evt) => {
                evt.stopPropagation();
                handleZoomToAnnotation(annotation);
              }}
              icon={<CrosshairsLooseIcon />}
            />
          </Tooltip>
        )}
        {annotationActive && (
          <Tooltip overlay="Remove Drawing" placement="top">
            <Button
              aria-label="Remove Drawing"
              className={loading ? OverlaysPanelStyles.overlaySpinnerIcon : OverlaysPanelStyles.overlayAddedIcon}
              variant="icon"
              onClick={(evt) => {
                evt.stopPropagation();
                handleAnnotationRemove(annotation);
              }}
              icon={loading ? <SpinnerIcon /> : <CheckIcon />}
            />
          </Tooltip>
        )}
      </>
    );

    const thumbnail = annotation.thumbnail
      ? datadriveGetOCSObjectDownloadPathForS3URL(annotation.thumbnail)
      : annotationFallbackImage;
    return (
      <ImageOverlay
        key={annotation.annotation_id}
        title={annotation.title}
        description={description}
        tooltip={annotation.description || 'No Description'}
        fallback={thumbnail}
        overlayActions={annotationActions}
        product={annotation}
        selectable={true}
        onClick={(evt) => {
          evt.stopPropagation();
          const skip = !!evt.target.closest(`.${ImageOverlayStyles.bottomContent}`);
          if (!skip) {
            if (!annotationActive) {
              handleAnnotationAdd(annotation);
            } else {
              handleAnnotationRemove(annotation);
            }
          }
        }}
        opacityAdjustable={annotationActive}
        opacity={annotation.opacity !== null ? annotation.opacity : 1}
        onChangeOpacity={(opacity) => handleAnnotationChangeOpacity(annotation, opacity)}
      />
    );
  };

  render() {
    const { newAnnotation, groups, activeProduct, allActiveAnnotations } = this.props;
    const productsWithSameOverlayId = groups.filter(
      (item) =>
        getPropFromProduct(item, config.es_mappings.overlay_id) ===
        getPropFromProduct(activeProduct, config.es_mappings.overlay_id)
    );
    const activeAnnotations = allActiveAnnotations.filter(
      (x) => getPropFromProduct(x, config.es_mappings.object_type) === 'm20-mv-annotation'
    );

    const annotations = productsWithSameOverlayId.filter(
      (p) => getPropFromProduct(p, config.es_mappings.object_type) === 'm20-mv-annotation'
    );

    const activeAnnotationsMap = activeAnnotations.reduce((annotationsMap, annotation) => {
      annotationsMap[annotation.annotation_id] = annotation;
      return annotationsMap;
    }, {});

    // Sort availableAnnotations by last updated date
    annotations.sort(
      (a, b) =>
        new Date(getPropFromProduct(b, config.es_mappings.updated_at)) -
        new Date(getPropFromProduct(a, config.es_mappings.updated_at))
    );

    if (!annotations.length) {
      return (
        <div className={OverlaysPanelStyles.contentRoot}>
          <Button full text="New Drawing" variant="secondary" onClick={() => newAnnotation()} />
          {!annotations.length && (
            <EmptyState text="No drawings found for this image group" icon={<EditIcon />}></EmptyState>
          )}
        </div>
      );
    }

    return (
      <>
        {this.modalTargetEl && ReactDOM.createPortal(this.renderDeletionModal(), this.modalTargetEl)}
        <div className={OverlaysPanelStyles.contentRoot}>
          <div className={OverlaysPanelStyles.overlaysList}>
            <Button full text="New Drawing" variant="secondary" onClick={() => newAnnotation()} />
            {annotations.map((annotation) => {
              const annotationActive = activeAnnotationsMap[annotation.annotation_id];
              const loading = annotationActive ? annotationActive.loading : false;
              return this.renderAvailableAnnotationResult(
                annotationActive ? annotationActive : annotation,
                !!annotationActive,
                loading
              );
            })}
          </div>
        </div>
      </>
    );
  }
}

AnnotationOverlays.propTypes = {
  groups: PropTypes.arrayOf(PropTypes.object).isRequired,
  user: PropTypes.object.isRequired,
  activeProduct: PropTypes.object.isRequired,
  handleAnnotationAdd: PropTypes.func.isRequired,
  handleAnnotationEdit: PropTypes.func.isRequired,
  handleAnnotationRemove: PropTypes.func.isRequired,
  handleZoomToAnnotation: PropTypes.func.isRequired,
  newAnnotation: PropTypes.func.isRequired,
};
export default AnnotationOverlays;

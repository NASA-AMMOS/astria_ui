import classNames from 'classnames';
import { Field, Form, Formik } from 'formik';
import debounce from 'lodash.debounce';
import PropTypes from 'prop-types';
import React from 'react';
import AnnotationShapeEditorStyles from '../styles/AnnotationShapeEditor.module.css';
import LayoutStyles from '../styles/common/layout.module.css';
import { getOpacityFromColor, hexToRgb, rgbStringToObject } from '../utils';
import Button from './common/Button';
import ColorPicker from './common/ColorPicker';
import IconInput from './common/IconInput';
import {
  FontSizeIcon,
  LetterSpacingIcon,
  LineHeightIcon,
  OpacityIcon,
  StrokeWidthIcon,
  VisibleHideIcon,
  VisibleShowIcon,
} from './common/Icons';
import Select from './common/Select';
import Tooltip from './common/Tooltip';

class AnnotationShapeEditor extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      _clipboard: {},
    };

    this.handleDuplicate = this.handleDuplicate.bind(this);

    this.debouncedUpdate = debounce(this.forceUpdate.bind(this), 150, {
      trailing: true,
    });
  }

  componentDidMount() {
    document.addEventListener('keydown', this.handleKeydown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeydown);
  }

  handleKeydown = (event) => {
    const { isEditing } = this.props;

    if ((event.ctrlKey || event.metaKey) && event.keyCode === 67) {
      // CTRL + C
      this.copySelection();
    } else if ((event.ctrlKey || event.metaKey) && event.keyCode === 86) {
      // CTRL + V
      if (document.activeElement.nodeName !== 'INPUT' && document.activeElement.nodeName !== 'TEXTAREA' && isEditing) {
        this.pasteSelection();
      }
    }
  };

  copySelection() {
    const { selectedShapes, osdWrapper } = this.props;
    if (!selectedShapes[0]) return;
    selectedShapes[0].canvas.getActiveObject().clone((cloned) => {
      this.setState({ _clipboard: cloned });
    }, osdWrapper._customFabricProperties);
  }

  pasteSelection(objToPaste = {}) {
    const { _clipboard } = this.state;
    const { osdWrapper, activeAnnotation } = this.props;
    const canvas = osdWrapper._fabricCanvas;

    if (!Object.keys(objToPaste).length) objToPaste = _clipboard;
    if (!Object.keys(objToPaste).length) return;

    // clone again, so you can do multiple copies.
    objToPaste.clone((clonedObj) => {
      canvas.discardActiveObject();
      clonedObj.set({
        left: clonedObj.left + 10,
        top: clonedObj.top + 10,
        shapeId: osdWrapper.getShapeId(),
        annotationId: activeAnnotation.annotation_id,
      });

      // multiple objects
      if (clonedObj.type === 'activeSelection') {
        // active selection needs a reference to the canvas.
        clonedObj.canvas = canvas;
        clonedObj.forEachObject((obj) => {
          obj.set({
            shapeId: osdWrapper.getShapeId(),
            annotationId: activeAnnotation.annotation_id,
          });
          canvas.add(obj);
        });
        clonedObj.setCoords();
        osdWrapper.recreateInternalShapeTrackers(clonedObj._objects);
      } else {
        canvas.add(clonedObj);
        osdWrapper.recreateInternalShapeTrackers([clonedObj]);
      }

      canvas.setActiveObject(clonedObj);
      canvas.requestRenderAll();
      this.copySelection();
    }, osdWrapper._customFabricProperties);
  }

  renderFillEditor() {
    let { selectedShapes } = this.props;
    selectedShapes =
      typeof selectedShapes === 'object' && !Array.isArray(selectedShapes) ? [selectedShapes] : selectedShapes;

    if (selectedShapes.length && selectedShapes.some((obj) => obj.get('fill'))) {
      const fill = selectedShapes.find((obj) => obj.get('fill')).get('fill');
      const opacity = Math.round(getOpacityFromColor(fill) * 100);
      const inputClasses = classNames({
        [AnnotationShapeEditorStyles.input]: true,
        [AnnotationShapeEditorStyles.hidden]: opacity === 0,
      });
      return (
        <>
          <div className={AnnotationShapeEditorStyles.editor}>
            <div className={AnnotationShapeEditorStyles.editorLabel}>Fill</div>
            <div className={AnnotationShapeEditorStyles.editorContent3x3}>
              <ColorPicker
                className={opacity === 0 ? AnnotationShapeEditorStyles.hidden : ''}
                defaultColor={fill}
                onChange={this.handleFillColorChange}
              />
              <Formik
                enableReinitialize
                initialValues={{ opacity }}
                onSubmit={(values, { setSubmitting }) => {
                  this.handlePropertyOpacityChange('fill', values.opacity);
                  setSubmitting(false);
                }}
              >
                {() => (
                  <Form noValidate autoComplete="off">
                    <Field name="opacity">
                      {({ field }) => {
                        const { value, onChange, ...otherFieldProps } = field;
                        return (
                          <Tooltip overlay="Fill Opacity" placement="bottom">
                            <div>
                              <IconInput
                                aria-label="Fill Opacity"
                                icon={<OpacityIcon />}
                                units="%"
                                min={0}
                                max={100}
                                step="5"
                                type="number"
                                className={inputClasses}
                                value={value}
                                onChange={(e) => {
                                  this.handlePropertyOpacityChange('fill', parseFloat(e.target.value));
                                  onChange(e);
                                }}
                                {...otherFieldProps}
                              />
                            </div>
                          </Tooltip>
                        );
                      }}
                    </Field>
                  </Form>
                )}
              </Formik>
              <Tooltip overlay={opacity ? 'Hide' : 'Show'} placement="left">
                {
                  <Button
                    aria-label={opacity ? 'Hide' : 'Show'}
                    variant="icon"
                    onClick={this.toggleFill}
                    icon={opacity ? <VisibleShowIcon /> : <VisibleHideIcon />}
                  />
                }
              </Tooltip>
            </div>
          </div>
          <div className={LayoutStyles.divider} />
        </>
      );
    }
  }

  renderOrderEditor() {
    const { selectedShapes } = this.props;
    if (selectedShapes.length) {
      return (
        <>
          <div className={AnnotationShapeEditorStyles.editor}>
            <div className={AnnotationShapeEditorStyles.editorLabel}>Order</div>
            <div className={AnnotationShapeEditorStyles.editorContent2x2}>
              {/* fix styling later, will be a diff design */}
              <Button
                style={{ padding: 0 }}
                variant="secondary"
                text="Bring to Front"
                onClick={this.handleBringToFront}
              />
              <Button
                style={{ padding: 0 }}
                variant="secondary"
                text="Bring Forward"
                onClick={this.handleBringForward}
              />
              <Button style={{ padding: 0 }} variant="secondary" text="Send to Back" onClick={this.handleSendToBack} />
              <Button
                style={{ padding: 0 }}
                variant="secondary"
                text="Send Backward"
                onClick={this.handleSendBackward}
              />
            </div>
          </div>
          <div className={LayoutStyles.divider} />
        </>
      );
    }
  }

  renderStrokeEditor() {
    const { selectedShapes } = this.props;
    if (selectedShapes.length && selectedShapes.some((obj) => obj.get('stroke'))) {
      const defaultOption = selectedShapes.find((obj) => obj.get('stroke'));
      const stroke = defaultOption.get('stroke');
      const strokeWidth = parseInt(defaultOption.get('strokeWidth'));
      const opacity = Math.round(getOpacityFromColor(stroke) * 100);
      const lineStyle = defaultOption.get('strokeDashArray')
        ? this.isDotted(defaultOption.get('strokeDashArray'))
          ? 'Dotted'
          : 'Dashed'
        : 'Solid';

      const inputClasses = classNames({
        [AnnotationShapeEditorStyles.input]: true,
        [AnnotationShapeEditorStyles.hidden]: opacity === 0,
      });
      return (
        <>
          <div className={AnnotationShapeEditorStyles.editor}>
            <div className={AnnotationShapeEditorStyles.editorLabel}>Stroke</div>
            <div className={AnnotationShapeEditorStyles.editorContent3x3}>
              <ColorPicker
                className={opacity === 0 ? AnnotationShapeEditorStyles.hidden : ''}
                defaultColor={stroke}
                onChange={this.handleStrokeColorChange}
              />
              <Formik
                enableReinitialize
                initialValues={{ opacity }}
                onSubmit={(values, { setSubmitting }) => {
                  this.handlePropertyOpacityChange('stroke', values.opacity);
                  setSubmitting(false);
                }}
              >
                {() => (
                  <Form noValidate autoComplete="off">
                    <Field name="opacity">
                      {({ field }) => {
                        const { value, onChange, ...otherFieldProps } = field;
                        return (
                          <Tooltip overlay="Stroke Opacity" placement="bottom">
                            <div>
                              <IconInput
                                aria-label="Stroke Opacity"
                                icon={<OpacityIcon />}
                                units="%"
                                min={0}
                                max={100}
                                step="5"
                                type="number"
                                className={inputClasses}
                                value={value}
                                onChange={(e) => {
                                  this.handlePropertyOpacityChange('stroke', parseFloat(e.target.value));
                                  onChange(e);
                                }}
                                {...otherFieldProps}
                              />
                            </div>
                          </Tooltip>
                        );
                      }}
                    </Field>
                  </Form>
                )}
              </Formik>
              <Tooltip overlay={opacity ? 'Hide' : 'Show'} placement="left">
                {
                  <Button
                    aria-label={opacity ? 'Hide' : 'Show'}
                    variant="icon"
                    onClick={this.toggleStroke}
                    icon={opacity ? <VisibleShowIcon /> : <VisibleHideIcon />}
                  />
                }
              </Tooltip>
              <Formik
                enableReinitialize
                initialValues={{ strokeWidth }}
                onSubmit={(values, { setSubmitting }) => {
                  this.handleStrokeWidthChange(values.strokeWidth);
                  setSubmitting(false);
                }}
              >
                {() => (
                  <Form noValidate autoComplete="off">
                    <Field name="strokeWidth">
                      {({ field }) => {
                        const { value, onChange, ...otherFieldProps } = field;
                        return (
                          <div>
                            <Tooltip overlay="Stroke Width" placement="bottom">
                              <IconInput
                                aria-label="Stroke Width"
                                icon={<StrokeWidthIcon />}
                                min={0}
                                max={64}
                                step="1"
                                type="number"
                                className={inputClasses}
                                value={value}
                                onChange={(e) => {
                                  this.handleStrokeWidthChange(parseFloat(e.target.value));
                                  onChange(e);
                                }}
                                {...otherFieldProps}
                              />
                            </Tooltip>
                          </div>
                        );
                      }}
                    </Field>
                  </Form>
                )}
              </Formik>
              <Formik
                enableReinitialize
                initialValues={{ strokeWidth }}
                onSubmit={(values, { setSubmitting }) => {
                  this.handleStrokeWidthChange(values.strokeWidth);
                  setSubmitting(false);
                }}
              >
                {() => (
                  <Form noValidate autoComplete="off">
                    <Field name="strokeWidth">
                      {({ field }) => {
                        const { value, onChange, ...otherFieldProps } = field;
                        const strokeWeights = [
                          { value: '4', label: 'Light' },
                          { value: '16', label: 'Medium' },
                          { value: '32', label: 'Heavy' },
                        ];
                        const defaultValue = strokeWeights.find((w) => parseInt(w.value) === value);
                        return (
                          <div>
                            <Select
                              label="Preset"
                              labelPosition="inner"
                              placeholder="Presets"
                              searchable={false}
                              className={inputClasses}
                              value={defaultValue || null}
                              options={strokeWeights}
                              onChange={(selectedOption) => {
                                this.handleStrokeWidthChange(parseInt(selectedOption.value));
                                onChange(selectedOption.value);
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
              <div></div>
              <Formik
                enableReinitialize
                initialValues={{ lineStyle }}
                onSubmit={(values, { setSubmitting }) => {
                  this.handleLineStyleChange(values.lineStyle);
                  setSubmitting(false);
                }}
              >
                {() => (
                  <Form noValidate autoComplete="off">
                    <Field name="lineStyle">
                      {({ field }) => {
                        const { value, onChange, ...otherFieldProps } = field;
                        const lineStyles = [
                          { value: 'Solid', label: 'Solid' },
                          { value: 'Dashed', label: 'Dashed' },
                          { value: 'Dotted', label: 'Dotted' },
                        ];
                        const defaultValue = lineStyles.find((w) => w.value === lineStyle);
                        return (
                          <Select
                            searchable={false}
                            className={opacity === 0 ? AnnotationShapeEditorStyles.hidden : ''}
                            defaultValue={defaultValue}
                            options={lineStyles}
                            onChange={(selectedOption) => {
                              this.handleLineStyleChange(selectedOption.value);
                              onChange(selectedOption.value);
                            }}
                            {...otherFieldProps}
                          />
                        );
                      }}
                    </Field>
                  </Form>
                )}
              </Formik>
            </div>
          </div>
          <div className={LayoutStyles.divider} />
        </>
      );
    }
  }

  renderObjectEditor() {
    const { selectedShapes } = this.props;
    if (selectedShapes.length) {
      const defaultOption = selectedShapes.find((obj) => obj.get('objOpacityLimit'));
      const opacity = defaultOption ? Math.round(defaultOption.get('objOpacityLimit') * 100) : 0;
      const inputClasses = classNames({
        [AnnotationShapeEditorStyles.input]: true,
        [AnnotationShapeEditorStyles.hidden]: opacity === 0,
      });
      return (
        <>
          <div className={AnnotationShapeEditorStyles.editor}>
            <div className={AnnotationShapeEditorStyles.editorLabel}>Object</div>
            <div className={AnnotationShapeEditorStyles.editorContent3x3}>
              <Formik
                enableReinitialize
                initialValues={{ opacity }}
                onSubmit={(values, { setSubmitting }) => {
                  this.handleOpacityChange(parseFloat(values.opacity));
                  setSubmitting(false);
                }}
              >
                {() => (
                  <Form noValidate autoComplete="off">
                    <Field name="opacity">
                      {({ field }) => {
                        const { value, onChange, ...otherFieldProps } = field;
                        return (
                          <Tooltip overlay="Object Opacity" placement="bottom">
                            <div>
                              <IconInput
                                aria-label="Object Opacity"
                                icon={<OpacityIcon />}
                                units="%"
                                min={0}
                                max={100}
                                step="5"
                                type="number"
                                className={inputClasses}
                                value={value}
                                onChange={(e) => {
                                  this.handleOpacityChange(parseFloat(e.target.value));
                                  onChange(e);
                                }}
                                {...otherFieldProps}
                              />
                            </div>
                          </Tooltip>
                        );
                      }}
                    </Field>
                  </Form>
                )}
              </Formik>
              <Tooltip overlay={opacity ? 'Hide' : 'Show'} placement="left">
                {
                  <Button
                    aria-label={opacity ? 'Hide' : 'Show'}
                    variant="icon"
                    onClick={this.toggleOpacity}
                    icon={opacity ? <VisibleShowIcon /> : <VisibleHideIcon />}
                  />
                }
              </Tooltip>
              {selectedShapes.length === 1 &&
                ['line', 'arrow', 'polyline', 'polygon'].indexOf(selectedShapes[0].get('shapeType')) !== -1 && (
                  <Button
                    style={{ gridColumn: 'span 3' }}
                    variant="secondary"
                    text="Edit Shape Points"
                    onClick={this.handleEditShapePoints}
                  />
                )}
              <Button
                style={{ gridColumn: 'span 3' }}
                variant="secondary"
                text={selectedShapes.length === 1 ? 'Duplicate Object' : 'Duplicate Objects'}
                onClick={this.handleDuplicate}
              />
              <Button
                style={{ gridColumn: 'span 3' }}
                variant="secondary"
                text={selectedShapes.length === 1 ? 'Remove Object' : 'Remove Objects'}
                onClick={this.handleRemove}
              />
            </div>
          </div>
          <div className={LayoutStyles.divider} />
        </>
      );
    }
  }

  renderTextEditor() {
    let { selectedShapes } = this.props;
    if (
      selectedShapes.length &&
      selectedShapes.some((obj) => obj.get('text') && typeof obj.get('fontSize') !== 'undefined')
    ) {
      const defaultOption = selectedShapes.find((obj) => obj.get('text') && typeof obj.get('fontSize') !== 'undefined');
      const fontSize = defaultOption.get('fontSize');
      const lineHeight = defaultOption.get('lineHeight');
      const fontWeight = defaultOption.get('fontWeight');
      const letterSpacing = defaultOption.get('charSpacing');
      return (
        <>
          <div className={AnnotationShapeEditorStyles.editor}>
            <div className={AnnotationShapeEditorStyles.editorLabel}>Text</div>
            <div className={AnnotationShapeEditorStyles.editorContent2x2}>
              <Formik
                enableReinitialize
                initialValues={{ fontWeight }}
                onSubmit={(values, { setSubmitting }) => {
                  this.handleFontWeightChange(values.fontWeight);
                  setSubmitting(false);
                }}
              >
                {() => (
                  <Form noValidate autoComplete="off">
                    <Field name="fontWeight">
                      {({ field }) => {
                        const { value, onChange, ...otherFieldProps } = field;
                        const fontWeights = [
                          { value: '800', label: 'Heavy' },
                          { value: '600', label: 'Bold' },
                          { value: '500', label: 'Medium' },
                          { value: '400', label: 'Regular' },
                        ];
                        const defaultValue = fontWeights.find((w) => w.value === fontWeight);
                        return (
                          <Select
                            searchable={false}
                            defaultValue={defaultValue}
                            options={fontWeights}
                            onChange={(selectedOption) => {
                              this.handleFontWeightChange(selectedOption.value);
                              onChange(selectedOption.value);
                            }}
                            {...otherFieldProps}
                          />
                        );
                      }}
                    </Field>
                  </Form>
                )}
              </Formik>
              <Formik
                enableReinitialize
                initialValues={{ fontSize }}
                onSubmit={(values, { setSubmitting }) => {
                  this.handleFontSizeChange(values.fontSize);
                  setSubmitting(false);
                }}
              >
                {() => (
                  <Form noValidate autoComplete="off">
                    <Field name="fontSize">
                      {({ field }) => {
                        const { value, onChange, ...otherFieldProps } = field;
                        return (
                          <Tooltip overlay="Font Size" placement="bottom">
                            <div>
                              <IconInput
                                aria-label="Font Size"
                                icon={<FontSizeIcon />}
                                min={1}
                                max={1000}
                                step="1"
                                type="number"
                                className={AnnotationShapeEditorStyles.input}
                                value={value}
                                onChange={(e) => {
                                  this.handleFontSizeChange(parseFloat(e.target.value));
                                  onChange(e);
                                }}
                                {...otherFieldProps}
                              />
                            </div>
                          </Tooltip>
                        );
                      }}
                    </Field>
                  </Form>
                )}
              </Formik>
              <Formik
                enableReinitialize
                initialValues={{ lineHeight }}
                onSubmit={(values, { setSubmitting }) => {
                  this.handleLineHeightChange(values.lineHeight);
                  setSubmitting(false);
                }}
              >
                {() => (
                  <Form noValidate autoComplete="off">
                    <Field name="lineHeight">
                      {({ field }) => {
                        const { value, onChange, ...otherFieldProps } = field;
                        return (
                          <Tooltip overlay="Line Height" placement="bottom">
                            <div>
                              <IconInput
                                aria-label="Line Height"
                                icon={<LineHeightIcon />}
                                min={0.5}
                                max={5}
                                step="0.25"
                                type="number"
                                className={AnnotationShapeEditorStyles.input}
                                value={value}
                                onChange={(e) => {
                                  this.handleLineHeightChange(parseFloat(e.target.value));
                                  onChange(e);
                                }}
                                {...otherFieldProps}
                              />
                            </div>
                          </Tooltip>
                        );
                      }}
                    </Field>
                  </Form>
                )}
              </Formik>
              <Formik
                enableReinitialize
                initialValues={{ letterSpacing }}
                onSubmit={(values, { setSubmitting }) => {
                  this.handleLetterSpacingChange(values.letterSpacing);
                  setSubmitting(false);
                }}
              >
                {() => (
                  <Form noValidate autoComplete="off">
                    <Field name="letterSpacing">
                      {({ field }) => {
                        const { value, onChange, ...otherFieldProps } = field;
                        return (
                          <Tooltip overlay="Letter Spacing" placement="bottom">
                            <div>
                              <IconInput
                                aria-label="Letter Spacing"
                                icon={<LetterSpacingIcon />}
                                min={-1000}
                                max={1000}
                                step="12"
                                type="number"
                                className={AnnotationShapeEditorStyles.input}
                                value={value}
                                onChange={(e) => {
                                  this.handleLetterSpacingChange(parseFloat(e.target.value));
                                  onChange(e);
                                }}
                                {...otherFieldProps}
                              />
                            </div>
                          </Tooltip>
                        );
                      }}
                    </Field>
                  </Form>
                )}
              </Formik>
            </div>
          </div>
          <div className={LayoutStyles.divider} />
        </>
      );
    }
  }

  render() {
    return (
      <div className={AnnotationShapeEditorStyles.root}>
        {this.renderTextEditor()}
        {this.renderFillEditor()}
        {this.renderStrokeEditor()}
        {this.renderObjectEditor()}
        {this.renderOrderEditor()}
      </div>
    );
  }

  cleanTextCharStyles(obj) {
    // If the object is a text box, we need to ensure that characters are not
    // individually styled since we don't support that and our current implementation
    // of text properties breaks if the styles are not cleared.
    if (obj.shapeType === 'text-box') obj.styles = {};
  }

  handleEditShapePoints = () => {
    const { osdWrapper, selectedShapes } = this.props;

    // can only edit when one shape is selected so it will always be [0]
    osdWrapper.startEditingShapePoints(selectedShapes[0]);
  };

  handleOpacityChange = (opacity) => {
    const { selectedShapes } = this.props;
    selectedShapes.forEach((obj) => {
      const annOpLimit = obj.get('annOpacityLimit');
      obj.set('objOpacityLimit', opacity / 100);
      obj.set('opacity', (opacity / 100) * annOpLimit);
      this.cleanTextCharStyles(obj);
    });
    selectedShapes[0].canvas.requestRenderAll();
    this.forceUpdate();
  };

  toggleOpacity = () => {
    const { selectedShapes } = this.props;
    selectedShapes.forEach((obj) => {
      const newOpacity = obj.opacity > 0 ? 0 : 1;
      obj.set('objOpacityLimit', newOpacity);
      obj.set('opacity', newOpacity);
      this.cleanTextCharStyles(obj);
    });
    selectedShapes[0].canvas.requestRenderAll();
    this.forceUpdate();
  };

  toggleFill = () => {
    const { selectedShapes } = this.props;
    selectedShapes.forEach((obj) => {
      if (obj.get('fill')) {
        let newFill;
        const currFill = obj.get('fill');
        if (currFill.indexOf('rgb') !== -1) {
          const currOpacity = getOpacityFromColor(currFill);
          const rgb = rgbStringToObject(currFill);
          const a = currOpacity > 0 ? 0 : 1;
          newFill = `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
        } else {
          const rgb = hexToRgb(currFill);
          newFill = `rgba(${rgb.r},${rgb.g},${rgb.b},0)`;
        }
        obj.set('fill', newFill);
        this.cleanTextCharStyles(obj);
      }
    });
    selectedShapes[0].canvas.requestRenderAll();
    this.forceUpdate();
  };

  handleFillColorChange = (color) => {
    const { selectedShapes } = this.props;
    selectedShapes.forEach((obj) => {
      if (obj.get('fill')) {
        obj.set('fill', color);
      }
      this.cleanTextCharStyles(obj);
    });
    selectedShapes[0].canvas.requestRenderAll();
    this.debouncedUpdate();
  };

  handlePropertyOpacityChange = (property, newOpacity) => {
    const { selectedShapes } = this.props;
    selectedShapes.forEach((obj) => {
      if (obj.get(property)) {
        let newColor;
        const currColor = obj.get(property);
        if (currColor.indexOf('rgb') !== -1) {
          const rgb = rgbStringToObject(currColor);
          newColor = `rgba(${rgb.r},${rgb.g},${rgb.b},${newOpacity / 100})`;
        } else {
          const rgb = hexToRgb(currColor);
          newColor = `rgba(${rgb.r},${rgb.g},${rgb.b},${newOpacity / 100})`;
        }

        obj.set(property, newColor);
        this.cleanTextCharStyles(obj);
      }
    });
    selectedShapes[0].canvas.requestRenderAll();
    this.forceUpdate();
  };

  toggleStroke = () => {
    const { selectedShapes } = this.props;
    selectedShapes.forEach((obj) => {
      if (obj.get('stroke')) {
        let newStroke;
        const currStroke = obj.get('stroke');
        if (currStroke.indexOf('rgb') !== -1) {
          const currOpacity = getOpacityFromColor(currStroke);
          const rgb = rgbStringToObject(currStroke);
          const a = currOpacity > 0 ? 0 : 1;
          newStroke = `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
        } else {
          const rgb = hexToRgb(currStroke);
          newStroke = `rgba(${rgb.r},${rgb.g},${rgb.b},0)`;
        }

        obj.set('stroke', newStroke);
        this.cleanTextCharStyles(obj);
      }
    });
    selectedShapes[0].canvas.requestRenderAll();
    this.forceUpdate();
  };

  handleStrokeColorChange = (color) => {
    const { selectedShapes } = this.props;

    selectedShapes.forEach((obj) => {
      obj.set('stroke', color);
      this.cleanTextCharStyles(obj);
    });
    selectedShapes[0].canvas.requestRenderAll();
    this.debouncedUpdate();
  };

  handleStrokeWidthChange = (val) => {
    const { selectedShapes } = this.props;

    selectedShapes.forEach((obj) => {
      obj.set('strokeWidth', val);

      // scale stroke dash array if found
      if (obj.get('strokeDashArray')) {
        const strokeDashArray = obj.get('strokeDashArray');
        if (this.isDotted(strokeDashArray)) {
          obj.set('strokeDashArray', this.getDottedStrokeArray(val));
        } else {
          obj.set('strokeDashArray', this.getDashedStrokeArray(val));
        }
      }
      this.cleanTextCharStyles(obj);
    });
    selectedShapes[0].canvas.requestRenderAll();
    this.forceUpdate();
  };

  isDotted(strokeDashArray) {
    return Math.round(strokeDashArray[1] / strokeDashArray[0]) === 3;
  }

  getDashedStrokeArray(val) {
    return [4 * val, 4 * val];
  }

  getDottedStrokeArray(val) {
    return [1 * val, 3 * val];
  }

  handleFontSizeChange = (val) => {
    const { selectedShapes } = this.props;

    // Do nothing if the value is NaN
    if (isNaN(val)) return;
    const safeVal = Math.max(0.5, val);

    selectedShapes.forEach((obj) => {
      if (obj.get('fontSize')) {
        obj.set('fontSize', safeVal);
        this.cleanTextCharStyles(obj);
        // recalculate text width since it may have been coming from a large text size
        // which causes the resulting smaller font size text to have an unusably large width
        // if no new width is set.
        obj.set('width', obj.calcTextWidth());
      }
    });
    selectedShapes[0].canvas.requestRenderAll();
  };

  handleLineHeightChange = (val) => {
    const { selectedShapes } = this.props;

    // Do nothing if the value is NaN
    if (isNaN(val)) return;
    const safeVal = Math.max(1, val);

    selectedShapes.forEach((obj) => {
      if (obj.get('lineHeight')) {
        obj.set('lineHeight', safeVal);
        this.cleanTextCharStyles(obj);
      }
    });
    selectedShapes[0].canvas.requestRenderAll();
  };

  handleLetterSpacingChange = (val) => {
    const { selectedShapes } = this.props;

    const safeVal = isNaN(val) || val === '' || val === 0 ? 8 : val;
    selectedShapes.forEach((obj) => {
      if (obj.get('charSpacing')) {
        obj.set('charSpacing', safeVal);
        this.cleanTextCharStyles(obj);
      }
    });
    selectedShapes[0].canvas.requestRenderAll();
  };

  handleFontWeightChange = (val) => {
    const { selectedShapes } = this.props;

    selectedShapes.forEach((obj) => {
      if (obj.get('fontWeight')) {
        obj.set('fontWeight', val);
        this.cleanTextCharStyles(obj);
      }
    });
    selectedShapes[0].canvas.requestRenderAll();
  };

  handleLineStyleChange = (val) => {
    const { selectedShapes } = this.props;

    selectedShapes.forEach((obj) => {
      if (obj.get('stroke')) {
        const strokeWidth = obj.get('strokeWidth');
        if (val === 'Dashed') obj.set('strokeDashArray', this.getDashedStrokeArray(strokeWidth));
        else if (val === 'Dotted') obj.set('strokeDashArray', this.getDottedStrokeArray(strokeWidth));
        else obj.set('strokeDashArray', null);
      }
      this.cleanTextCharStyles(obj);
    });
    selectedShapes[0].canvas.requestRenderAll();
  };

  handleRemove = () => {
    const { selectedShapes, osdWrapper } = this.props;

    selectedShapes.forEach((obj) => {
      osdWrapper.removeShape(obj);
    });
  };

  handleDuplicate = () => {
    const { selectedShapes } = this.props;
    const canvas = selectedShapes[0].canvas;

    // don't duplicate control points
    const activeObj = canvas.getActiveObject();
    if (activeObj.shapeType === 'controlPoint') {
      this.pasteSelection(selectedShapes[0]);
    } else if (activeObj.getObjects) {
      // multi-selection means we need to filter out control points
      const objs = activeObj.getObjects();
      const cps = objs.filter((obj) => obj.shapeType === 'controlPoint');
      cps.forEach((cp) => activeObj.removeWithUpdate(cp));
      this.pasteSelection(activeObj);
    } else {
      this.pasteSelection(activeObj);
    }
  };

  handleBringToFront = () => {
    const { selectedShapes } = this.props;

    selectedShapes.forEach((obj) => {
      obj.canvas.bringToFront(obj);
    });
    selectedShapes[0].canvas.requestRenderAll();
  };

  handleBringForward = () => {
    const { selectedShapes } = this.props;

    selectedShapes.forEach((obj) => {
      obj.canvas.bringForward(obj);
    });
    selectedShapes[0].canvas.requestRenderAll();
  };

  handleSendToBack = () => {
    const { selectedShapes } = this.props;

    selectedShapes.forEach((obj) => {
      obj.canvas.sendToBack(obj);
    });
    selectedShapes[0].canvas.requestRenderAll();
  };

  handleSendBackward = () => {
    const { selectedShapes } = this.props;

    selectedShapes.forEach((obj) => {
      obj.canvas.sendBackwards(obj);
    });
    selectedShapes[0].canvas.requestRenderAll();
  };
}

AnnotationShapeEditor.defaultProps = {
  selectedShapes: [],
};

AnnotationShapeEditor.propTypes = {
  selectedShapes: PropTypes.arrayOf(PropTypes.object),
};

export default AnnotationShapeEditor;

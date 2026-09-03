import PropTypes from 'prop-types';
import React from 'react';
import Button from 'src/components/common/Button';
import { SearchIcon } from 'src/components/common/Icons';
import Tooltip from 'src/components/common/Tooltip';
import DataCursorControlStyles from 'src/styles/DataCursorControl.module.css';
import FormsStyles from 'src/styles/Forms.module.css';

export class DataCursorControl extends React.Component {
  constructor(props) {
    super(props);

    this.lineInputRef = React.createRef();
    this.sampleInputRef = React.createRef();

    this.state = {
      cursor: { ...props.cursor },
    };
  }

  componentDidUpdate(prevProps) {
    const { cursor: propCursor } = this.props;
    const { cursor: prevCursor } = prevProps;

    const prevCursorDiff =
      propCursor.active !== prevCursor.active ||
      propCursor.line !== prevCursor.line ||
      propCursor.sample !== prevCursor.sample;
    if (prevCursorDiff) {
      this.setState({ cursor: propCursor });
    }
  }

  submitPointSearch = () => {
    const { product, cursor, addDataCursor, removeDataCursor, noChangeSearch } = this.props;
    if (this.sampleInputRef.current && this.lineInputRef.current) {
      const sample = this.sampleInputRef.current.value;
      const line = this.lineInputRef.current.value;
      const intSample = parseInt(sample);
      const intLine = parseInt(line);
      if (sample && intSample >= 0 && line && intLine >= 0) {
        addDataCursor(product, intSample, intLine);
        if (intSample === cursor.sample && intLine === cursor.line && noChangeSearch) {
          noChangeSearch();
        }
      } else if (typeof removeDataCursor === 'function' && (typeof sample !== 'number' || typeof line !== 'number')) {
        removeDataCursor();
      } else {
        this.sampleInputRef.current.value = cursor.sample;
        this.lineInputRef.current.value = cursor.line;
      }
    }
  };

  updateSampleValue = (evt) => {
    this.updateCursorValue(evt.target.value, this.state.cursor.line);
  };

  updateLineValue = (evt) => {
    this.updateCursorValue(this.state.cursor.sample, evt.target.value);
  };

  updateCursorValue = (sample, line) => {
    this.setState({ cursor: { sample, line } });
  };

  render() {
    const { cursor: stateCursor } = this.state;

    const sampleValue = stateCursor.sample && stateCursor.sample >= 0 ? stateCursor.sample : '';
    const lineValue = stateCursor.line && stateCursor.line >= 0 ? stateCursor.line : '';

    return (
      <form
        onSubmit={(evt) => {
          evt.preventDefault();
          evt.stopPropagation();
          this.submitPointSearch();
        }}
        className={DataCursorControlStyles.root}
      >
        <div className={DataCursorControlStyles.inputWrapper}>
          <div className={FormsStyles.label}>Sample</div>
          <input
            ref={this.sampleInputRef}
            className={FormsStyles.textInput}
            placeholder="sample"
            aria-label="Sample"
            type="number"
            value={sampleValue}
            onChange={this.updateSampleValue}
          />
        </div>
        <div className={DataCursorControlStyles.inputWrapper}>
          <div className={FormsStyles.label}>Line</div>
          <input
            ref={this.lineInputRef}
            className={FormsStyles.textInput}
            placeholder="line"
            aria-label="Line"
            type="number"
            value={lineValue}
            onChange={this.updateLineValue}
          />
        </div>
        <input hidden type="submit" value="Submit" />
        <Tooltip overlay="Search" placement="top">
          <Button
            aria-label="Search"
            variant="icon"
            type="submit"
            icon={<SearchIcon />}
            className={DataCursorControlStyles.inlineSearchButton}
          />
        </Tooltip>
      </form>
    );
  }
}

DataCursorControl.defaultProps = {
  product: null,
  cursor: {},
  noChangeSearch: null,
};

DataCursorControl.propTypes = {
  product: PropTypes.object,
  cursor: PropTypes.object,
  addDataCursor: PropTypes.func.isRequired,
  removeDataCursor: PropTypes.func.isRequired,
  noChangeSearch: PropTypes.func,
};

export default DataCursorControl;

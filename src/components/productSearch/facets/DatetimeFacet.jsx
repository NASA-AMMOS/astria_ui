import classNames from 'classnames';
import 'flatpickr/dist/themes/dark.css'; // base style
import moment from 'moment';
import PropTypes from 'prop-types';
import React from 'react';
import Flatpickr from 'react-flatpickr';
import ShortcutButtonsPlugin from 'shortcut-buttons-flatpickr';
import Button from 'src/components/common/Button';
import { CloseIcon, SearchIcon } from 'src/components/common/Icons';
import Tooltip from 'src/components/common/Tooltip';
import FacetSearchStyles from 'src/styles/FacetSearch.module.css';
import FlatpickrThemeStyles from 'src/styles/flatpickrTheme.module.css'; // color overrides
import FormsStyles from 'src/styles/Forms.module.css';

const PRINT_TIME_FORMAT = 'YYYY-MM-DD[T]HH:mm:ss';
const QUERY_TIME_FORMAT = 'YYYY-MM-DD[T]HH:mm:ss[Z]';

const datetimePlugins = [
  ShortcutButtonsPlugin({
    button: [
      {
        label: 'Now',
        attributes: { class: FlatpickrThemeStyles.customButton },
      },
      { label: 'Close', attributes: { class: FlatpickrThemeStyles.customButton } },
    ],
    onClick: (index, fp) => {
      if (index === 0) {
        // Not including seconds here because you can't include them anywhere else and it causes a query
        // to be triggered twice once the seconds are removed
        const date = moment.utc().seconds(0).format(PRINT_TIME_FORMAT);
        fp.setDate(date, true);
      } else fp.close();
    },
  }),
];

class DatetimeFacet extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      values: [],
    };
    this.localDate = moment();
    this.startPickerRef = React.createRef();
    this.endPickerRef = React.createRef();
    this.dirtyStartTime = null;
    this.dirtyEndTime = null;
    this.dirtyInput = false;
  }

  componentDidMount() {
    const { values } = this.props;

    // listen for intermediate text changes
    if (this.startPickerRef.current) {
      this.startPickerRef.current.flatpickr.input.addEventListener('keyup', (evt) => {
        const val = evt.target.value;
        this.dirtyStartTime = val;
        this.dirtyInput = true;
      });
    }
    if (this.endPickerRef.current) {
      this.endPickerRef.current.flatpickr.input.addEventListener('keyup', (evt) => {
        const val = evt.target.value;
        this.dirtyEndTime = val;
        this.dirtyInput = true;
      });
    }

    // update values with the dirty input value on blur
    if (this.startPickerRef.current) {
      this.startPickerRef.current.flatpickr.input.addEventListener('blur', (_evt) => {
        const val = this.dirtyStartTime;
        if (this.dirtyInput && val !== this.state.values[0]) {
          if (val) {
            this.onDateChange(val, 'start');
          } else {
            this.onClear('start');
          }
          this.dirtyInput = false;
        }
      });
    }
    if (this.endPickerRef.current) {
      this.endPickerRef.current.flatpickr.input.addEventListener('blur', (_evt) => {
        const val = this.dirtyEndTime;
        if (this.dirtyInput && val !== this.state.values[1]) {
          if (val) {
            this.onDateChange(val, 'end');
          } else {
            this.onClear('end');
          }
          this.dirtyInput = false;
        }
      });
    }

    // initialize state values
    this.setState({
      values: values
        ? values.map((x) => {
            const date = moment(x, [PRINT_TIME_FORMAT, QUERY_TIME_FORMAT]);
            if (date.isValid()) {
              return date.format(PRINT_TIME_FORMAT);
            }
            return null;
          })
        : [],
    });
  }

  async componentDidUpdate(prevProps) {
    const { inverted, onChange, values } = this.props;

    // If we get a new value from props, update state
    // This covers cases like clearing the value externally
    const diff =
      this.props.values.length !== prevProps.values.length ||
      this.props.values.reduce((acc, val, i) => val !== prevProps.values[i] || acc, false);
    if (diff) {
      this.setState({
        values: this.props.values
          ? this.props.values.map((x) => {
              const date = moment(x, [PRINT_TIME_FORMAT, QUERY_TIME_FORMAT]);
              if (date.isValid()) {
                return date.format(PRINT_TIME_FORMAT);
              }
              return null;
            })
          : [],
      });
    }

    if (prevProps.inverted !== inverted) {
      const query = await this.getQuery(values);
      onChange(query, values);
    }
  }

  getQuery(values = []) {
    return new Promise((resolve) => {
      const {
        facet: { dataField, variant },
        inverted,
      } = this.props;

      if (!values.length || !(values[0] || values[1])) {
        resolve(null);
      }

      let query = null;
      if (variant.indexOf('cutoff') !== -1) {
        query = {
          range: {
            [dataField]: {
              gte: values[0],
              format: 'date_optional_time',
            },
          },
        };
        resolve(query);
      } else if (variant.indexOf('range') !== -1) {
        query = {
          range: {
            [dataField]: {
              format: 'date_optional_time',
            },
          },
        };

        if (values[0]) {
          query.range[dataField].gte = moment(values[0], [PRINT_TIME_FORMAT, QUERY_TIME_FORMAT]).format(
            QUERY_TIME_FORMAT
          );
        }
        if (values[1]) {
          query.range[dataField].lte = moment(values[1], [PRINT_TIME_FORMAT, QUERY_TIME_FORMAT]).format(
            QUERY_TIME_FORMAT
          );
        }
      }

      const mustOrMustNot = inverted ? 'must_not' : 'must';
      const finalQuery = {
        bool: {
          [mustOrMustNot]: query,
        },
      };
      resolve(finalQuery);
    });
  }

  onSubmit = () => {
    const { values } = this.state;
    const { onChange } = this.props;
    this.getQuery(values).then((query) => {
      onChange(query, query ? values : null);
    });
  };

  onClear = (flag) => {
    let newValues = [];
    if (flag === 'start') {
      newValues = [...this.state.values];
      newValues[0] = null;
    }
    if (flag === 'end') {
      newValues = [...this.state.values];
      newValues[1] = null;
    }
    this.setState({ values: newValues }, this.onSubmit);
  };

  onDateChange = (datetime, flag) => {
    const {
      facet: { variant },
    } = this.props;

    const { values } = this.state;

    let parsed = moment(datetime, [PRINT_TIME_FORMAT, QUERY_TIME_FORMAT]);
    if (!parsed.isValid()) {
      parsed = moment(datetime); // fallback to vanilla js date parsing
      if (!parsed.isValid()) {
        return;
      }
    }

    const newValue = parsed.format(PRINT_TIME_FORMAT);

    const newValues = [...values];
    const isRange = variant.indexOf('range') !== -1;
    if (isRange) {
      // prep default values
      if (newValues.length === 0) {
        newValues[0] = null;
        newValues[1] = null;
      }

      if (flag === 'end') {
        newValues[1] = newValue;
      } else {
        newValues[0] = newValue;
      }
    } else {
      newValues[0] = newValue;
    }

    this.setState({ values: newValues }, this.onSubmit);
  };

  renderSinglePicker = () => {
    const {
      facet: { placeholder, variant },
    } = this.props;

    const { values: stateValues } = this.state;
    const date = moment(stateValues[0], [PRINT_TIME_FORMAT, QUERY_TIME_FORMAT]);
    const dateStr = stateValues.length > 0 && date.isValid() ? date.format(PRINT_TIME_FORMAT) : null;

    const isCompact = variant.indexOf('compact') !== -1;

    const inputContainerClasses = classNames({
      [FormsStyles.autosuggestInputContainer]: true,
      [FormsStyles.iconRight]: true,
      [FormsStyles.inputCompact]: isCompact,
      [FormsStyles.inputNormal]: !isCompact,
      '_prevent-controls-overlay-close': true,
    });

    return (
      <div className={inputContainerClasses}>
        <Flatpickr
          ref={this.startPickerRef}
          className={FormsStyles.autosuggestInput}
          onChange={(datetimes) => this.onDateChange(datetimes[0], 'start')}
          placeholder={placeholder}
          aria-label={this.props.facet.label}
          value={dateStr}
          // add class to overlay once ready, no prop to use here unfortunately, use this to
          // tell our ControlsOverlay to view this element as "inside" the ControlsOverlay. This avoids
          // ControlsOverlay close when the Date Picker overlay extends outside the bounds of the ControlsOverlay.
          onReady={(x, y, fp) => fp.calendarContainer.classList.add('prevent-controls-overlay-close')}
          options={{
            dateFormat: 'Y-m-dTH:i:S',
            enableTime: true,
            enableSeconds: true,
            allowInput: true,
            time_24hr: true,
            plugins: datetimePlugins,
          }}
        />
        {stateValues.length > 0 ? (
          <Button
            aria-label="Clear"
            variant="icon"
            onClick={() => this.onClear()}
            icon={<CloseIcon />}
            className={FormsStyles.autosuggestClearIcon}
          />
        ) : null}
        <Tooltip overlay="Search" placement="top">
          <Button
            aria-label="Search"
            variant="icon"
            onClick={() => this.onSubmit()}
            icon={<SearchIcon />}
            className={FormsStyles.autosuggestSearchIcon}
          />
        </Tooltip>
      </div>
    );
  };

  renderRangePicker = () => {
    const {
      facet: { placeholder, variant },
    } = this.props;

    const { values: stateValues } = this.state;
    const dateStrs = stateValues.map((date) => (date ? moment(date, [PRINT_TIME_FORMAT, QUERY_TIME_FORMAT]) : null));
    const startDate = dateStrs[0] && dateStrs[0].isValid() ? dateStrs[0].format(PRINT_TIME_FORMAT) : null;
    const endDate = dateStrs[1] && dateStrs[1].isValid() ? dateStrs[1].format(PRINT_TIME_FORMAT) : null;

    const isCompact = variant.indexOf('compact') !== -1;

    const inputContainerClasses = classNames({
      [FormsStyles.autosuggestInputContainer]: true,
      [FormsStyles.iconRight]: true,
      [FormsStyles.inputCompact]: isCompact,
      [FormsStyles.inputNormal]: !isCompact,
      'prevent-controls-overlay-close': true,
    });

    if (isCompact) {
      return (
        <div className={inputContainerClasses}>
          <Flatpickr
            ref={this.startPickerRef}
            className={FormsStyles.autosuggestInput}
            onChange={(datetimes) => this.onDateChange(datetimes[0], 'start')}
            placeholder={placeholder}
            value={startDate}
            aria-label="Start date"
            // add class to overlay once ready, no prop to use here unfortunately, use this to
            // tell our ControlsOverlay to view this element as "inside" the ControlsOverlay. This avoids
            // ControlsOverlay close when the Date Picker overlay extends outside the bounds of the ControlsOverlay.
            onReady={(x, y, fp) => fp.calendarContainer.classList.add('prevent-controls-overlay-close')}
            options={{
              dateFormat: 'Y-m-dTH:i:S',
              enableTime: true,
              enableSeconds: true,
              allowInput: true,
              time_24hr: true,
              plugins: datetimePlugins,
            }}
          />
          {startDate ? (
            <Button
              aria-label="Clear"
              variant="icon"
              onClick={() => this.onClear('start')}
              icon={<CloseIcon />}
              className={FormsStyles.autosuggestClearIcon}
            />
          ) : null}
          <span className={FacetSearchStyles.compactRangeSeparator}>to</span>
          <Flatpickr
            ref={this.endPickerRef}
            className={FormsStyles.autosuggestInput}
            onChange={(datetimes) => this.onDateChange(datetimes[0], 'end')}
            placeholder={placeholder}
            value={endDate}
            aria-label="End date"
            // add class to overlay once ready, no prop to use here unfortunately, use this to
            // tell our ControlsOverlay to view this element as "inside" the ControlsOverlay. This avoids
            // ControlsOverlay close when the Date Picker overlay extends outside the bounds of the ControlsOverlay.
            onReady={(x, y, fp) => fp.calendarContainer.classList.add('prevent-controls-overlay-close')}
            options={{
              dateFormat: 'Y-m-dTH:i:S',
              enableTime: true,
              enableSeconds: true,
              allowInput: true,
              time_24hr: true,
              plugins: datetimePlugins,
            }}
          />
          {endDate ? (
            <Button
              aria-label="Clear"
              variant="icon"
              onClick={() => this.onClear('end')}
              icon={<CloseIcon />}
              className={FormsStyles.autosuggestClearIcon}
            />
          ) : null}
          <Tooltip overlay="Search" placement="top">
            <Button
              aria-label="Search"
              variant="icon"
              onClick={() => this.onSubmit()}
              icon={<SearchIcon />}
              className={FormsStyles.autosuggestSearchIcon}
            />
          </Tooltip>
        </div>
      );
    } else {
      return (
        <>
          <div className={FormsStyles.label}>Start</div>
          <div className={inputContainerClasses}>
            <Flatpickr
              ref={this.startPickerRef}
              className={FormsStyles.autosuggestInput}
              onChange={(datetimes) => this.onDateChange(datetimes[0], 'start')}
              placeholder={placeholder}
              value={startDate}
              aria-label="Start date"
              // add class to overlay once ready, no prop to use here unfortunately, use this to
              // tell our ControlsOverlay to view this element as "inside" the ControlsOverlay. This avoids
              // ControlsOverlay close when the Date Picker overlay extends outside the bounds of the ControlsOverlay.
              onReady={(x, y, fp) => fp.calendarContainer.classList.add('prevent-controls-overlay-close')}
              options={{
                dateFormat: 'Y-m-dTH:i:S',
                enableTime: true,
                enableSeconds: true,
                allowInput: true,
                time_24hr: true,
                plugins: datetimePlugins,
              }}
            />
            {startDate ? (
              <Button
                aria-label="Clear"
                variant="icon"
                onClick={() => this.onClear('start')}
                icon={<CloseIcon />}
                className={FormsStyles.autosuggestClearIcon}
              />
            ) : null}
          </div>
          <div className={FormsStyles.label}>End</div>
          <div className={inputContainerClasses}>
            <Flatpickr
              ref={this.endPickerRef}
              className={FormsStyles.autosuggestInput}
              onChange={(datetimes) => this.onDateChange(datetimes[0], 'end')}
              placeholder={placeholder}
              value={endDate}
              aria-label="End date"
              // add class to overlay once ready, no prop to use here unfortunately, use this to
              // tell our ControlsOverlay to view this element as "inside" the ControlsOverlay. This avoids
              // ControlsOverlay close when the Date Picker overlay extends outside the bounds of the ControlsOverlay.
              onReady={(x, y, fp) => fp.calendarContainer.classList.add('prevent-controls-overlay-close')}
              options={{
                dateFormat: 'Y-m-dTH:i:S',
                enableTime: true,
                enableSeconds: true,
                allowInput: true,
                time_24hr: true,
                plugins: datetimePlugins,
              }}
            />
            {endDate ? (
              <Button
                aria-label="Clear"
                variant="icon"
                onClick={() => this.onClear('end')}
                icon={<CloseIcon />}
                className={FormsStyles.autosuggestClearIcon}
              />
            ) : null}
          </div>
          <Tooltip overlay="Search" placement="top">
            <Button
              aria-label="Search"
              variant={isCompact ? 'icon' : 'secondary'}
              onClick={() => this.onSubmit()}
              icon={isCompact ? <SearchIcon /> : null}
              full={!isCompact}
              text={!isCompact ? 'Search' : null}
              className={isCompact ? FacetSearchStyles.inlineSearchButton : FacetSearchStyles.fullSearchButton}
            />
          </Tooltip>
        </>
      );
    }
  };

  render() {
    const {
      facet: { variant, label, defaults, facetID },
      values,
      inverted,
      setComponentInverted,
    } = this.props;

    const isCompact = variant.indexOf('compact') !== -1;
    const isRange = variant.indexOf('range') !== -1;

    const inversionEnabled = values.length || !!defaults;
    const labelEl = (
      <>
        <div className={FormsStyles.inlineLabelChildren}>
          {<div className={FormsStyles.label}>{label}</div>}
          {inversionEnabled && (
            <Button
              text={!inverted ? 'Invert' : 'Clear Inversion'}
              variant="text"
              onClick={() => setComponentInverted(!inverted, facetID)}
            />
          )}
        </div>
      </>
    );

    return (
      <div className={FormsStyles.autosuggestWrapper}>
        {isCompact && labelEl}
        {isRange ? this.renderRangePicker() : this.renderSinglePicker()}
      </div>
    );
  }
}

DatetimeFacet.defaultProps = {
  values: [],
  baseQueries: [],
  onInputChange: () => {},
};

DatetimeFacet.propTypes = {
  baseQueries: PropTypes.array,
  facet: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  onInputChange: PropTypes.func,
  values: PropTypes.array,
  inverted: PropTypes.bool,
};

export default DatetimeFacet;

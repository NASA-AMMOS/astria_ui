import classNames from 'classnames';
import debounce from 'lodash.debounce';
import PropTypes from 'prop-types';
import React from 'react';
import Autosuggest from 'react-autosuggest';
import ReactDOM from 'react-dom';
import Modal from 'react-modal';
import Button from 'src/components/common/Button';
import { CloseIcon, SearchIcon } from 'src/components/common/Icons';
import RadioButton from 'src/components/common/RadioButton';
import Select from 'src/components/common/Select';
import { USING_CSSO } from 'src/constants/api';
import alertStyles from 'src/styles/Alert.module.css';
import FacetSearchStyles from 'src/styles/FacetSearch.module.css';
import FormsStyles from 'src/styles/Forms.module.css';
import ScienceIntentFacetStyles from 'src/styles/ScienceIntentFacet.module.css';
import * as telemetry from 'src/utils/telemetryUtils';
import urlJoin from 'url-join';

import config from 'config.js';
let suggestionsRequestId;
let searchController;

class ScienceIntentFacet extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      searchValue: '',
      currentInputValue: '',
      activeItem: null,
      selectedItem: null,
      results: [],
      suggestions: [],
      loadingSuggestions: false,
      isModalOpen: false,
    };

    this.closeModal = this.closeModal.bind(this);
    this.onSelectItemClick = this.onSelectItemClick.bind(this);
    this.setItemActive = this.setItemActive.bind(this);
    this.clearActiveItem = this.clearActiveItem.bind(this);
    this.ref = React.createRef();
    this.lastRequestId = null;
    this.debouncedLoadSuggestions = debounce(this.loadSuggestions.bind(this), 250, {
      trailing: true,
    });
    this.modalTargetEl = document.getElementById('genericModalPortalTarget');
  }

  async componentDidMount() {
    try {
      const results = await this.searchItems();
      this.setState({ results });
    } catch (err) {}
  }

  async componentDidUpdate(prevProps) {
    const { values, inverted, onChange } = this.props;
    // Cover the case where the component value was cleared
    if (prevProps.values[0] && !values[0]) {
      this.setState({ activeItem: null, selectedItem: null });
    }

    if (prevProps.inverted !== inverted) {
      const query = await this.getQuery(values);
      onChange(query, values);
    }
  }

  async getQuery(values = [], activityIDs) {
    const {
      facet: { ocsDataField: dataField },
      inverted,
    } = this.props;
    if (!values.length && !activityIDs) return;

    let finalActivityIDs = activityIDs;
    // TODO break svfp into two functions? Setting state during a getQuery feels wrong.
    if (!activityIDs) finalActivityIDs = await this.setValueFromProps(values[0]);

    const mustOrMustNot = inverted ? 'must_not' : 'must';
    return finalActivityIDs.length
      ? {
          bool: {
            [mustOrMustNot]: {
              terms: { [dataField]: finalActivityIDs },
            },
          },
        }
      : null;
  }

  async setValueFromProps(itemID) {
    const {
      facet: { scienceIntentItem },
    } = this.props;
    // let item = null;
    let activityIDs = [];
    if (!itemID) {
      this.clearActiveItem();
    } else {
      // Retrieve item metadata by name
      let matchingItems;
      try {
        // Try/catch the search since we're using abort controller which could abort if
        // props change
        matchingItems = await this.searchItems('id', itemID, true, true);
      } catch (err) {
        // Nothing to do since this is an abort error
        matchingItems = [];
      }
      if (matchingItems.length) {
        const item = matchingItems[0];

        // skip fetching conections since in this case we already have a connected result
        // so no need to handle an abort error
        activityIDs = await this.getActivityIDsFromItem(item, false);
        this.setState({ activeItem: item, selectedItem: item });
        // return { item, activityIDs }; // don't need this here right? setStte wont do anything funky?
        // TODO getting string and sometime numbers as value prop, clean this up
      } else {
        telemetry.logWarning(`Unable to get activity IDs for ${scienceIntentItem}`, itemID);
      }
    }
    return activityIDs;
  }

  clearActiveItem() {
    this.setState({ activeItem: null, selectedItem: null });
    this.props.onChange();
  }

  async getActivityIDsFromItem(item, findConnections = true) {
    const {
      facet: { scienceIntentItem },
    } = this.props;
    const finalItem = { ...item };
    // Fetch connections if item is a task since those aren't initially fetched for performance reasons
    if (scienceIntentItem === 'TASK' && findConnections) {
      const matchingItems = await this.searchItems('id', item.id, true, true);
      if (matchingItems.length && matchingItems[0].connections) {
        finalItem.connections = matchingItems[0].connections;
      } else {
        telemetry.logWarning(`Unable to get activity IDs for TASK`, item.id);
        return [];
      }
    }

    // Extract activity IDs from item connections
    return finalItem.connections
      .filter((connection) => connection.foreign_key.indexOf('activity_') === 0)
      .map((connection) => connection.foreign_key.split('activity_')[1]);
  }

  async setItemActive(item) {
    if (!item) {
      this.clearActiveItem();
      this.props.onChange();
      this.setState({ isModalOpen: false });
      return;
    }

    this.setState({ activeItem: item, submitting: true });
    try {
      const activityIDs = await this.getActivityIDsFromItem(item);
      const query = await this.getQuery([], activityIDs);
      this.setState({ isModalOpen: false, submitting: false });
      this.props.onChange(query, [item.id]);
    } catch (err) {
      // Abort or network error from searchItems in getActivityIDsFromItem
      this.setState({ submitting: false });
    }
  }

  onSelectItemClick() {
    this.setState({ isModalOpen: true });
  }

  getSuggestionValue(suggestion) {
    return suggestion.title;
  }

  renderSuggestion(suggestion) {
    return <span>{suggestion.title}</span>;
  }

  renderInputComponent = (inputProps, clear) => {
    const containerClasses = classNames({
      [FormsStyles.autosuggestInputContainer]: true,
      [FormsStyles.inputNormal]: true,
    });
    return (
      <div className={containerClasses}>
        <span className={FormsStyles.autosuggestSearchIcon}>
          <SearchIcon />
        </span>
        <input {...inputProps} />
        {inputProps.value && (
          <Button
            aria-label="Clear"
            variant="icon"
            onClick={() => clear()}
            icon={<CloseIcon />}
            className={FormsStyles.autosuggestClearIcon}
          />
        )}
      </div>
    );
  };

  async searchItems(key = 'title', text = '', forceConnections = false, abortPrevious = false) {
    const {
      facet: { scienceIntentItem },
    } = this.props;
    const { statusFilter } = this.state;

    let statusParam = '';
    if (statusFilter && statusFilter.value !== 'any') statusParam = `&status=${statusFilter.value}`;

    const goalParam = scienceIntentItem === 'TASK' ? '&include=goals' : '';

    const type = scienceIntentItem === 'GOAL' ? 'goals' : 'tasks';
    const includeConnections = forceConnections || scienceIntentItem === 'GOAL';

    const url = urlJoin(
      config.api_endpoints.ScienceIntent.API,
      `${type}?${key}=${text}&include=metadata${
        includeConnections ? '&include=connections' : ''
      }${goalParam}&sort=created_at${statusParam}`
    );
    try {
      let signal;
      if (abortPrevious) {
        // Abort in flight search if it exists
        if (searchController) searchController.abort();
        searchController = new AbortController();
        signal = searchController.signal;
      }

      const response = await fetch(url, { ...(USING_CSSO ? { credentials: 'include' } : null), signal });
      if (!response || !response.ok) return [];
      const json = await response.json();
      if (!json.data || !json.data.length) return [];
      else return json.data;
    } catch (err) {
      if (err.name !== 'AbortError') {
        telemetry.logError('Error searching items in ScienceIntentFacet', err);
        throw new Error('ScienceIntentFacet item search failed');
      } else {
        throw new Error('Search aborted');
      }
    }
  }

  async loadSuggestions(value) {
    // Use a unique ID to ensure that only the most recent
    // request is applied
    suggestionsRequestId = Math.random();
    const currSuggestionsRequestId = suggestionsRequestId;

    this.setState({
      loadingSuggestions: true,
    });

    try {
      const suggestions = await this.searchItems('title', value);
      if (currSuggestionsRequestId === suggestionsRequestId) {
        this.setState({
          loadingSuggestions: false,
          suggestions,
        });
      }
    } catch (err) {}
  }

  onInputChange = async (event, { newValue, method }) => {
    if (method === 'click') this.onInputSubmit(newValue);
    if (method === 'enter') {
      try {
        const results = await this.searchItems('title', newValue);
        this.setState({
          results,
          searchValue: newValue,
        });
      } catch (err) {}
    } else {
      // Otherwise just some keypress, update input
      this.setState({
        currentInputValue: newValue,
      });
    }
  };

  onInputSubmit = async (newValue) => {
    try {
      const results = await this.searchItems('title', newValue);
      this.setState({
        searchValue: newValue,
        results,
      });
    } catch (err) {}
  };

  onSuggestionsFetchRequested = ({ value }) => {
    this.debouncedLoadSuggestions(value);
  };

  onSuggestionsClearRequested = () => {
    this.setState({
      suggestions: [],
    });
  };

  handleInputClear = () => {
    this.setState({
      suggestions: [],
      currentInputValue: '',
      searchValue: '',
      loadingSuggestions: false,
    });
    this.onInputSubmit();
  };

  getCampaignByCampaignID(campaignID) {
    return this.props.campaigns.find((campaign) => campaign.uuid === campaignID);
  }

  onItemClicked(item) {
    this.setState({
      selectedItem: item,
    });
  }

  renderItem(item) {
    const {
      facet: { scienceIntentItem },
    } = this.props;
    let campaigns = [];
    if (scienceIntentItem === 'GOAL') {
      // Guard against somewhat casual API results
      if (!item.connections) item.connections = [];
      item.connections
        .filter((x) => x.foreign_key.indexOf('campaign_') === 0)
        .map((x) => {
          const campaignID = x.foreign_key.split('campaign_')[1];
          return this.getCampaignByCampaignID(campaignID);
        });
    }
    const isSelected = this.state.selectedItem ? item.id === this.state.selectedItem.id : false;
    let secondaryContent = '';
    if (scienceIntentItem === 'GOAL') {
      secondaryContent = (
        <div className={ScienceIntentFacetStyles.secondaryContentGoal}>
          <span>{item.status}</span>
          {!!campaigns.length && (
            <>&nbsp;•&nbsp;{campaigns.map((campaign) => (campaign ? campaign.name : 'Unknown Campaign')).join(', ')}</>
          )}
        </div>
      );
    } else if (scienceIntentItem === 'TASK') {
      secondaryContent = (
        <div className={ScienceIntentFacetStyles.secondaryContentTask}>
          {item.goals && !!item.goals.length && (
            <span className={ScienceIntentFacetStyles.secondaryContentTaskParent}>Goal: {item.goals[0].title}</span>
          )}
          <span>{item.status}</span>
        </div>
      );
    }
    return (
      <div
        tabIndex={0}
        onClick={() => this.onItemClicked(item)}
        onKeyDown={(event) => {
          // fire our on change when we see enter key pressed
          if (event.keyCode === 13) {
            this.onItemClicked(item);
          }
        }}
        className={ScienceIntentFacetStyles.scienceIntentResult}
        key={item.id}
      >
        <div className={ScienceIntentFacetStyles.topRow}>
          <RadioButton tabIndex={-1} selected={isSelected} />
          <span>{item.title}</span>
        </div>
        <div className={ScienceIntentFacetStyles.bottomRow}>{secondaryContent}</div>
      </div>
    );
  }

  renderModal() {
    const { currentInputValue, selectedItem, searchValue, suggestions, results, isModalOpen } = this.state;
    const {
      facet: { label, scienceIntentItem },
    } = this.props;

    const inputProps = {
      placeholder: `Search ${label}s`,
      value: currentInputValue,
      onKeyDown: (event) => {
        // fire our on change when we see enter key pressed
        if (event.keyCode === 13) {
          this.onInputSubmit(currentInputValue);
        }
      },
      onChange: (event, metadata) => {
        this.onInputChange(event, metadata);
      },
    };
    const modalClass = classNames({
      [alertStyles.alert]: true,
      [ScienceIntentFacetStyles.modal]: true,
    });
    return (
      <Modal
        overlayClassName={{
          // TODO move these into a diff stylesheet, maybe abstract this into generic modal
          base: alertStyles.overlayBase,
          afterOpen: alertStyles.afterOpen,
          beforeClose: alertStyles.beforeClose,
        }}
        className={modalClass}
        isOpen={isModalOpen}
        onRequestClose={this.closeModal}
        shouldCloseOnOverlayClick
        shouldCloseOnEsc
      >
        <div className={alertStyles.headerContainer}>
          <div className={alertStyles.title}>Select {scienceIntentItem === 'GOAL' ? 'Goal' : 'Task'}</div>
          <Button aria-label="Close" variant="icon" icon={<CloseIcon />} onClick={this.closeModal} />
        </div>
        <div className={ScienceIntentFacetStyles.content}>
          <Autosuggest
            theme={{
              container: ScienceIntentFacetStyles.autosuggestContainer,
              containerOpen: FormsStyles.autosuggestContainerOpen,
              input: FormsStyles.autosuggestInput,
              inputOpen: FormsStyles.autosuggestInputOpen,
              suggestionsContainer: FormsStyles.autosuggestSuggestionsContainer,
              suggestionsContainerOpen: FormsStyles.autosuggestSuggestionsContainerOpen,
              suggestionHighlighted: FormsStyles.autosuggestSuggestionHighlighted,
              suggestion: FormsStyles.autosuggestSuggestion,
              suggestionsList: FormsStyles.autosuggestSuggestionsList,
            }}
            suggestions={suggestions}
            onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
            onSuggestionsClearRequested={this.onSuggestionsClearRequested}
            getSuggestionValue={this.getSuggestionValue}
            renderSuggestion={this.renderSuggestion}
            renderInputComponent={(inputProps) => this.renderInputComponent(inputProps, this.handleInputClear)}
            inputProps={inputProps}
          />
          <Select
            className={ScienceIntentFacetStyles.select}
            defaultValue={{ value: 'any', label: 'Any Status' }}
            searchable={false}
            options={[
              { value: 'any', label: 'Any Status' },
              { value: 'draft', label: 'Draft' },
              { value: 'final', label: 'Final' },
              { value: 'closed', label: 'Closed' },
            ]}
            onChange={(selectedOption) => {
              this.setState({ statusFilter: selectedOption }, () => {
                this.onInputSubmit(currentInputValue);
              });
            }}
          />
          <div className={ScienceIntentFacetStyles.scienceIntentResults}>
            {!results.length && (
              <div className={ScienceIntentFacetStyles.noResultsMessage}>
                Your search <b>{searchValue}</b> did not match any {scienceIntentItem === 'GOAL' ? 'goals' : 'tasks'}.
              </div>
            )}
            {!!results.length && results.map((x) => this.renderItem(x))}
          </div>
        </div>
        <div className={alertStyles.actionRow}>
          <Button variant="secondary" text="Cancel" onClick={this.closeModal} />
          <Button
            variant="primary"
            text={this.state.submitting ? 'Sumbitting...' : 'Done'}
            disabled={this.state.submitting}
            onClick={() => this.setItemActive(selectedItem)}
          />
        </div>
      </Modal>
    );
  }

  closeModal() {
    // If submitting is in progress we'll just cancel the submission but won't close yet Close the modal
    if (this.state.submitting && searchController) {
      searchController.abort();
      searchController = null;
    }
    const optState = {};
    // Attempt to find the value in state to reset if possible
    try {
      let activeItem = null;
      let selectedItem = null;
      if (this.props.values[0]) {
        const item = this.state.results.find((x) => x.id === parseInt(this.props.values[0]));
        if (item) {
          activeItem = item;
          selectedItem = item;
        }
      }
      optState.activeItem = activeItem;
      optState.selectedItem = selectedItem;
    } catch (err) {
      telemetry.logError('Error resetting Science Intent Modal', err);
    }
    this.setState({ isModalOpen: false, submitting: false, ...optState });
  }

  render() {
    const {
      facet: { scienceIntentItem },
    } = this.props;
    const { activeItem } = this.state;
    const itemTypeLabel = scienceIntentItem === 'GOAL' ? 'Goal' : 'Task';

    return (
      <div>
        <div className={ScienceIntentFacetStyles.facet}>
          {!activeItem && (
            <div className={FacetSearchStyles.selectionStatusMessage}>
              <span>No {itemTypeLabel} Selected</span>
            </div>
          )}
          {activeItem && (
            <div className={FacetSearchStyles.selectionStatusMessage}>
              <span>{itemTypeLabel} Selected</span>
              <Button variant="text" onClick={() => this.setItemActive()} text="Clear" />
            </div>
          )}
          <Button full onClick={this.onSelectItemClick} variant="secondary" text={`Select ${itemTypeLabel}`} />
        </div>
        {ReactDOM.createPortal(this.renderModal(), this.modalTargetEl)}
      </div>
    );
  }
}

ScienceIntentFacet.defaultProps = {
  values: [],
};

ScienceIntentFacet.propTypes = {
  campaigns: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  values: PropTypes.array.isRequired,
  inverted: PropTypes.bool,
};

export default ScienceIntentFacet;

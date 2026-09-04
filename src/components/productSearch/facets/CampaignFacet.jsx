import classNames from 'classnames';
import debounce from 'lodash.debounce';
import PropTypes from 'prop-types';
import React from 'react';
import Autosuggest from 'react-autosuggest';
import Checkbox from 'src/components/common/Checkbox';
import CampaignFacetStyles from 'src/styles/CampaignFacet.module.css';
import FacetSearchStyles from 'src/styles/FacetSearch.module.css';
import FormsStyles from 'src/styles/Forms.module.css';
import { getConfig } from 'src/utils/configRegistry';
import { scienceIntentGetConnectionsByCampaignID } from 'src/utils/endpoints';
import * as telemetry from 'src/utils/telemetryUtils';

let suggestionsRequestId;

class CampaignFacet extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      searchValue: '',
      activeCampaignIDs: [],
      suggestions: [],
      isSettingValue: false,
    };

    this.lastRequestId = null;
    this.debouncedLoadSuggestions = debounce(this.loadSuggestions.bind(this), 50, {
      trailing: true,
    });
  }

  async componentDidUpdate(prevProps) {
    const { values, onChange, inverted } = this.props;

    if (prevProps.inverted !== inverted) {
      const query = await this.getQuery(values);
      onChange(query, values);
    }
  }

  async getQuery(values = []) {
    const {
      facet: { ocsDataField: dataField },
      inverted,
    } = this.props;
    if (!values.length) return;

    this.setState({ isSettingValue: true });
    let activityIDs = await this.getValuesFromProps(values);
    this.setState({ isSettingValue: false });

    const mustOrMustNot = inverted ? 'must_not' : 'must';
    return activityIDs.length
      ? {
          bool: {
            [mustOrMustNot]: {
              terms: { [dataField]: activityIDs },
            },
          },
        }
      : null;
  }

  async getValuesFromProps(campaignNames) {
    if (!campaignNames || !campaignNames.length) return [];
    try {
      const data = await Promise.all(
        campaignNames.map((campaignName) => {
          const campaignID = this.getCampaignIDByCampaignName(campaignName);
          return this.getActivityIDsForCampaign(campaignID);
        })
      );
      return data.flat(); // join the activity ID results
    } catch (err) {
      telemetry.logError('Unable to get activity IDs for campaign name(s)', err);
      return [];
    }
  }

  getCampaignIDByCampaignName(campaignName) {
    const matchingCampaign = this.props.campaigns.find((campaign) => campaign.name === campaignName);
    return matchingCampaign ? matchingCampaign.uuid : null;
  }

  getSuggestionValue(suggestion) {
    return suggestion.name;
  }

  renderSuggestion(suggestion) {
    return <span>{suggestion.name}</span>;
  }

  renderInputComponent = ({ key, ...inputProps }) => {
    const containerClasses = classNames({
      [FormsStyles.autosuggestInputContainer]: true,
      [FormsStyles.inputCompact]: true,
    });
    return (
      <div className={containerClasses}>
        <input key={key} {...inputProps} />
      </div>
    );
  };

  async getActivityIDsForCampaign(campaignID) {
    if (!campaignID) return [];
    const url = scienceIntentGetConnectionsByCampaignID(campaignID);
    const response = await fetch(url, { ...(getConfig().using_csso ? { credentials: 'include' } : null) });

    if (!response || !response.ok) return ['Err'];
    try {
      const json = await response.json();
      if (!json.data || !json.data.length) {
        return [];
      } else {
        const activityIDMap = {};
        json.data.forEach((result) => {
          result.goals.forEach((goal) => {
            goal.connections.forEach((connection) => {
              if (connection.foreign_key.indexOf('activity_') === 0) {
                activityIDMap[connection.foreign_key.split('activity_')[1]] = true;
              }
            });
          });
        });
        return Object.keys(activityIDMap);
      }
    } catch (err) {
      telemetry.logError('Error in getActivityIDsForCampaign', err);
      return [];
    }
  }

  async loadSuggestions(value) {
    // Use a unique ID to ensure that only the most recent
    // request is applied
    suggestionsRequestId = Math.random();
    const currSuggestionsRequestId = suggestionsRequestId;

    // const suggestions = await this.fetchSuggestions(value);
    const suggestions = this.props.campaigns.filter((x) => x.name.toLowerCase().indexOf(value.toLowerCase()) > -1);

    if (currSuggestionsRequestId === suggestionsRequestId) {
      this.setState({
        suggestions,
      });
    }
  }

  onInputChange = async (_event, { newValue, method: _method }) => {
    this.setState({
      searchValue: newValue,
    });
  };

  onSuggestionSelected = async (newValue) => {
    let newSearchValue = newValue;
    const newValues = this.props.values.slice();
    const idx = newValues.indexOf(newValue);
    if (idx < 0) newValues.push(newValue);
    newSearchValue = ''; // clear search input
    const query = await this.getQuery(newValues);
    this.setState({
      searchValue: newSearchValue,
    });
    this.props.onChange(query, newValues);
  };

  onCheckboxChange = async (campaign, checked) => {
    const newValues = this.props.values.slice();
    if (checked) newValues.push(campaign.name);
    else {
      const idx = newValues.indexOf(campaign.name);
      if (idx > -1) newValues.splice(idx, 1);
    }
    const query = await this.getQuery(newValues);
    this.props.onChange(query, newValues);
  };

  onSuggestionsFetchRequested = ({ value }) => {
    this.debouncedLoadSuggestions(value);
  };

  onSuggestionsClearRequested = () => {
    this.setState({
      suggestions: [],
    });
  };

  render() {
    const { values: propValues, campaigns } = this.props;

    const { searchValue, suggestions, isSettingValue } = this.state;
    const inputProps = {
      placeholder: 'Search Campaigns',
      value: searchValue,
      disabled: isSettingValue,
      onChange: (event, metadata) => {
        this.onInputChange(event, metadata);
      },
    };
    return (
      <div className={CampaignFacetStyles.container}>
        {!!campaigns.length && (
          <Autosuggest
            theme={{
              container: FormsStyles.autosuggestContainer,
              containerOpen: FormsStyles.autosuggestContainerOpen,
              input: FormsStyles.autosuggestInput,
              inputOpen: FormsStyles.autosuggestInputOpen,
              suggestionsContainer: FormsStyles.autosuggestSuggestionsContainer,
              suggestionsContainerOpen: FormsStyles.autosuggestSuggestionsContainerOpen,
              suggestionHighlighted: FormsStyles.autosuggestSuggestionHighlighted,
              suggestion: FormsStyles.autosuggestSuggestion,
              suggestionsList: FormsStyles.autosuggestSuggestionsList,
            }}
            disabled={true}
            suggestions={suggestions}
            onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
            onSuggestionsClearRequested={this.onSuggestionsClearRequested}
            onSuggestionSelected={(_event, { suggestionValue }) => {
              this.onSuggestionSelected(suggestionValue);
            }}
            getSuggestionValue={this.getSuggestionValue}
            renderSuggestion={this.renderSuggestion}
            renderInputComponent={(inputProps) => this.renderInputComponent(inputProps)}
            inputProps={inputProps}
          />
        )}
        <div className={CampaignFacetStyles.options}>
          {!campaigns.length && <div className={FacetSearchStyles.multiListMessage}>No Campaigns Found</div>}
          {!!campaigns.length &&
            campaigns
              .sort((a, b) => a.id - b.id)
              .map((campaign) => {
                const isChecked = !!propValues && propValues.indexOf(campaign.name) > -1;
                return (
                  <Checkbox
                    disabled={isSettingValue}
                    key={campaign.uuid}
                    value={campaign.uuid}
                    label={campaign.name}
                    checked={isChecked}
                    onChange={() => {
                      this.onCheckboxChange(campaign, !isChecked);
                    }}
                  />
                );
              })}
        </div>
      </div>
    );
  }
}

CampaignFacet.defaultProps = {
  values: [],
};

CampaignFacet.propTypes = {
  campaigns: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  values: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string])),
  inverted: PropTypes.bool,
};

export default CampaignFacet;

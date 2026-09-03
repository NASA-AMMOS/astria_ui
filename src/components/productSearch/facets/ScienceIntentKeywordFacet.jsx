import InputFacet from 'src/components/productSearch/facets/InputFacet';
import { objAlphaSort } from 'src/utils';

class ScienceIntentKeywordFacet extends InputFacet {
  async getQuery(values = []) {
    const {
      facet: { dataField },
      inverted,
    } = this.props;
    const matchedValues = this.locallySearchKeywords(values[0]);
    const mustOrMustNot = inverted ? 'must_not' : 'must';
    return values.length
      ? {
          bool: {
            [mustOrMustNot]: {
              terms: { [dataField]: matchedValues },
            },
          },
        }
      : null;
  }

  onTopHitClick(newValue) {
    const aliasedValue = this.getAliasedValue(newValue);
    // get the query object
    this.getQuery([aliasedValue]).then((query) => {
      const value = newValue ? [aliasedValue] : null;
      query = newValue ? query : null;
      // check for type of change
      this.props.onChange(query, value);
    });
  }

  sortResults(results) {
    return objAlphaSort(
      results.map((result) => {
        return { ...result, name: this.getAliasedValue(result.name).toString() };
      }), // ensure name keys are strings
      'name'
    );
  }

  wildcardSearch(query, string) {
    const transformedQuery = query.replace(/[*]/g, '.*').toLowerCase().trim();
    return !!new RegExp('^' + transformedQuery + '$').test(string.toLowerCase());
  }

  onSuggestionsFetchRequested = ({ value }) => {
    this.loadSuggestions(value);
  };

  getSuggestionValue(suggestion) {
    return suggestion.name;
  }

  renderSuggestion(suggestion) {
    return <span>{suggestion.name}</span>;
  }

  locallySearchKeywords(queryString) {
    const { keywordsMap } = this.props;
    const escapedValue = this.escapeValue(queryString);

    // Get list of possible keywords based on user query
    return Object.values(keywordsMap)
      .filter((keyword) => this.wildcardSearch(`${escapedValue}*`, keyword.name.toLowerCase()))
      .map((keyword) => keyword.id);
  }

  async loadSuggestions(value) {
    this.setState({ isLoadingSuggestions: true });

    const unfilteredResults = this.locallySearchKeywords(value);
    const { results, error, stale } = await this.fetchValues('suggestions', unfilteredResults, 5);
    if (!error && !stale) {
      const aliasedSuggestions = results.map((result) => {
        const aliasedValue = this.getAliasedValue(result.name);
        return { name: aliasedValue, value: aliasedValue };
      });
      this.setState({ isLoadingSuggestions: false, suggestions: aliasedSuggestions });
    } else this.setState({ isLoading: false });
  }

  async fetchTopHits(optValue) {
    this.setState({ isLoadingTopHits: true });

    const { value: stateValue } = this.state;
    const value = typeof optValue === 'string' ? optValue : stateValue;

    const unfilteredResults = this.locallySearchKeywords(value);
    const { results, error, stale } = await this.fetchValues('topHits', unfilteredResults, 50);
    if (!error && !stale) {
      const aliasedSuggestions = results.map((result) => {
        const aliasedValue = this.getAliasedValue(result.name);
        return { name: aliasedValue, value: aliasedValue };
      });
      // Sort top results alphabetically
      const sortedResults = this.sortResults(aliasedSuggestions);
      this.setState({ isLoadingTopHits: false, topHits: sortedResults });
    } else {
      // Otherwise only reset loading state if there was an error as stale results indicate another request in flight
      if (error) this.setState({ isLoadingTopHits: true });
    }
  }

  getAliasedValue(value) {
    const { keywordsMap } = this.props;
    return keywordsMap[value]?.name || value;
  }

  lookupAliasedValue(v) {
    const aliasedValue = v || '';
    const { keywordsMap } = this.props;
    const keyword = Object.values(keywordsMap).find((e) => e.name.toLowerCase() === aliasedValue.toLowerCase());
    if (keyword) return keyword.id.toString();
    else return v;
  }

  getTopHitLabel(value) {
    return this.getAliasedValue(value);
  }
}

export default ScienceIntentKeywordFacet;

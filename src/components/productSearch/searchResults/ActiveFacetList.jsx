import Chip from 'src/components/common/Chip';
import FacetSearchStyles from 'src/styles/FacetSearch.module.css';
import { formatFacetValueForDisplay, isFacetValueDefault } from 'src/utils/searchUtils';

const ActiveFacetList = ({
  searchValues,
  defaultValues,
  searchInversions,
  facetsMap,
  goalsMap,
  tasksMap,
  searchBaseReady,
  onClearFacet,
}) => {
  const searchValuesEntries = Object.entries(searchValues);
  let content;

  if (!searchValuesEntries.length && Object.keys(searchInversions).length < 1) {
    content = <div className={FacetSearchStyles.noActiveFiltersMessage}>No filters selected</div>;
  } else if (!searchBaseReady) {
    content = <div className={FacetSearchStyles.noActiveFiltersMessage}>Loading...</div>;
  } else {
    content = searchValuesEntries.reduce((acc, entry) => {
      const [key, value] = entry;
      const facet = facetsMap[key];
      const searchInverted = !!searchInversions[facet.facetID];

      let valueStr = '';
      if (facet.type === 'multilist' && searchInverted) {
        valueStr = 'All values';
      } else {
        valueStr = formatFacetValueForDisplay(facet, value, goalsMap, tasksMap);
      }

      if (defaultValues[facet.key].length) {
        if (!isFacetValueDefault(facet, value, defaultValues) || searchInverted) {
          acc.push(
            <Chip
              key={key}
              label={facet.label}
              value={valueStr}
              onClick={() => onClearFacet(key)}
              leftLabel={searchInverted ? 'Not' : ''}
            />
          );
        }
      } else {
        acc.push(
          <Chip
            key={key}
            label={facet.label}
            value={valueStr}
            onClick={() => onClearFacet(key)}
            leftLabel={searchInverted ? 'Not' : ''}
          />
        );
      }
      return acc;
    }, []);

    if (!content.length) {
      content = <div className={FacetSearchStyles.noActiveFiltersMessage}>No filters selected</div>;
    }
  }

  return (
    <div className={FacetSearchStyles.filterRow}>
      <div className={FacetSearchStyles.selectedFiltersContainer}>{content}</div>
    </div>
  );
};

export default ActiveFacetList;

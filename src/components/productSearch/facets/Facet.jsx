import PropTypes from 'prop-types';
import CampaignFacet from 'src/components/productSearch/facets/CampaignFacet';
import DatetimeFacet from 'src/components/productSearch/facets/DatetimeFacet';
import DynamicRangeFacet from 'src/components/productSearch/facets/DynamicRangeFacet';
import FootprintFacet from 'src/components/productSearch/facets/FootprintFacet';
import InputFacet from 'src/components/productSearch/facets/InputFacet';
import MultiInputFacet from 'src/components/productSearch/facets/MultiInputFacet';
import MultiListFacet from 'src/components/productSearch/facets/MultiListFacet';
import MultiValueInputFacet from 'src/components/productSearch/facets/MultiValueInputFacet';
import RadioMultiListFacet from 'src/components/productSearch/facets/RadioMultiListFacet';
import RangeFacet from 'src/components/productSearch/facets/RangeFacet';
import RangeSelectFacet from 'src/components/productSearch/facets/RangeSelectFacet';
import ScienceIntentFacet from 'src/components/productSearch/facets/ScienceIntentFacet';
import ScienceIntentKeywordFacet from 'src/components/productSearch/facets/ScienceIntentKeywordFacet';
import TileFacet from 'src/components/productSearch/facets/TileFacet';

const Facet = ({ onFacetInputChange = () => {}, ...props }) => {
  const {
    facet,
    facetValues,
    groupResults,
    baseQueries,
    queryComponents,
    facetsRegistered,
    queryID,
    campaigns,
    keywordsMap,
    onFacetChange,
    inverted,
    setComponentInverted,
    openHelpArticle,
  } = props;

  // Collect search query components for this facet, e.g. all of them besides the query for this particular facet
  // since we don't want the facet to be filtering using it's own filter
  const queryComponentsForFacet = Object.keys(queryComponents).filter((key) => key !== facet.facetID);

  // Transform qc into flat list
  const queryComponentsList = queryComponentsForFacet.map((key) => queryComponents[key]).flat();

  const onChangeHandler = (query, values) => onFacetChange(facet.facetID, query, values);
  const onInputChangeHandler = (query, value) => onFacetInputChange(facet.facetID, query, value);

  // Get common props
  const commonFacetProps = {
    ref: facet.ref,
    values: facetValues,
    inverted,
    facet,
    onChange: onChangeHandler,
    onInputChange: onInputChangeHandler,
    setComponentInverted,
    openHelpArticle,
  };
  if (facet.type === 'multilist') {
    return (
      <MultiListFacet
        baseQueries={baseQueries}
        queryComponents={queryComponentsList}
        queryID={queryID}
        registering={!facetsRegistered}
        groupResults={groupResults}
        {...commonFacetProps}
      />
    );
  }
  if (facet.type === 'radiomultilist') {
    return (
      <RadioMultiListFacet
        baseQueries={baseQueries}
        queryComponents={queryComponentsList}
        queryID={queryID}
        registering={!facetsRegistered}
        groupResults={groupResults}
        {...commonFacetProps}
      />
    );
  }
  if (facet.type === 'range') {
    return <RangeFacet {...commonFacetProps} />;
  }
  if (facet.type === 'dynamic-range') {
    return (
      <DynamicRangeFacet
        registering={!facetsRegistered}
        baseQueries={baseQueries}
        queryComponents={queryComponentsList}
        queryID={queryID}
        {...commonFacetProps}
      />
    );
  }
  if (facet.type === 'input') {
    return (
      <InputFacet
        groupResults={groupResults}
        registering={!facetsRegistered}
        baseQueries={baseQueries}
        queryComponents={queryComponentsList}
        queryID={queryID}
        {...commonFacetProps}
      />
    );
  }
  if (facet.type === 'multiinput') {
    return (
      <MultiInputFacet
        registering={!facetsRegistered}
        groupResults={groupResults}
        baseQueries={baseQueries}
        {...commonFacetProps}
      />
    );
  }
  if (facet.type === 'scienceintentkeyword') {
    return (
      <ScienceIntentKeywordFacet
        keywordsMap={keywordsMap}
        registering={!facetsRegistered}
        groupResults={groupResults}
        baseQueries={baseQueries}
        queryComponents={queryComponentsList}
        queryID={queryID}
        {...commonFacetProps}
      />
    );
  }
  if (facet.type === 'tile') {
    return (
      <TileFacet
        groupResults={groupResults}
        registering={!facetsRegistered}
        baseQueries={baseQueries}
        queryComponents={queryComponentsList}
        queryID={queryID}
        {...commonFacetProps}
      />
    );
  }
  if (facet.type === 'scienceIntent') {
    return <ScienceIntentFacet campaigns={campaigns} {...commonFacetProps} />;
  }
  if (facet.type === 'campaign') {
    return <CampaignFacet campaigns={campaigns} {...commonFacetProps} />;
  }
  if (facet.type === 'datetime') {
    return <DatetimeFacet {...commonFacetProps} />;
  }
  if (facet.type === 'scilo-footprint') {
    return <FootprintFacet baseQueries={baseQueries} {...commonFacetProps} />;
  }
  if (facet.type === 'range-select') {
    return (
      <RangeSelectFacet
        registering={!facetsRegistered}
        baseQueries={baseQueries}
        queryComponents={queryComponentsList}
        queryID={queryID}
        {...commonFacetProps}
      />
    );
  }
  if (facet.type === 'multivalueinput') {
    return (
      <MultiValueInputFacet
        baseQueries={baseQueries}
        groupResults={groupResults}
        registering={!facetsRegistered}
        queryComponents={queryComponentsList}
        queryID={queryID}
        {...commonFacetProps}
      />
    );
  }
  console.warn('Facet with type:', facet.type, 'not supported.', facet);
  return <div>Unknown Facet</div>;
};

Facet.propTypes = {
  baseQueries: PropTypes.array.isRequired,
  facet: PropTypes.object.isRequired,
  facetValues: PropTypes.array.isRequired,
  groupResults: PropTypes.bool.isRequired,
  queryComponents: PropTypes.object.isRequired,
  facetsRegistered: PropTypes.bool.isRequired,
  queryID: PropTypes.number.isRequired,
  campaigns: PropTypes.array.isRequired,
  keywordsMap: PropTypes.object.isRequired,
  onFacetChange: PropTypes.func.isRequired,
  onFacetInputChange: PropTypes.func,
  inverted: PropTypes.bool.isRequired,
  setComponentInverted: PropTypes.func.isRequired,
  openHelpArticle: PropTypes.func.isRequired,
};

export default Facet;

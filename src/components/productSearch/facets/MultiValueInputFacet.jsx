import PropTypes from 'prop-types';
import React from 'react';
import Button from 'src/components/common/Button';
import Tooltip from 'src/components/common/Tooltip';
import InputFacet from 'src/components/productSearch/facets/InputFacet';
import FacetSearchStyles from 'src/styles/FacetSearch.module.css';

const JOIN_STR = '___';

class MultiValueInputFacet extends React.Component {
  constructor(props) {
    super(props);

    this.kRefMap = {};
    const {
      facet: { key: facetKeys },
    } = props;
    facetKeys.forEach((k) => {
      this.kRefMap[k] = React.createRef(k);
    });

    this.state = {
      kqvlMap: {}, // {key: [key, query, value, label]} map
    };
  }

  async componentDidMount() {
    const {
      facet: { key: facetKeys },
      values,
    } = this.props;

    const kqvlMapNew = {};
    for (const k of facetKeys) {
      const valueStr = values.find((valStr) => valStr.split(JOIN_STR)[0] === k);
      if (valueStr) {
        const pieces = valueStr.split(JOIN_STR);
        const label = [pieces[1]];
        const value = [pieces[2]];
        const q = await this.kRefMap[k].current.getQuery(value);
        kqvlMapNew[k] = [k, q, value, label];
      }
    }
    this.setState({ kqvlMap: kqvlMapNew });
  }

  async componentDidUpdate(prevProps) {
    // If we get a new value from props, update state
    // This covers cases like clearing the value externally
    const prevValStr = prevProps.values.join('');
    const currValStr = this.props.values.join('');
    if (prevValStr !== currValStr) {
      const {
        facet: { key: facetKeys },
      } = this.props;

      const kqvlMapNew = {};
      for (const k of facetKeys) {
        const valueStr = this.props.values.find((valStr) => valStr.split(JOIN_STR)[0] === k);
        if (valueStr) {
          const pieces = valueStr.split(JOIN_STR);
          const label = [pieces[1]];
          const value = [pieces[2]];
          const q = await this.kRefMap[k].current.getQuery(value);
          kqvlMapNew[k] = [k, q, value, label];
        }
      }
      this.setState({ kqvlMap: kqvlMapNew });
    }

    if (prevProps.inverted !== this.props.inverted) {
      const query = await this.getQuery(this.props.values);
      this.props.onChange(this.applyInversion(query), this.props.values);
    }
  }

  onInputFacetChange = (changeFacet, query, value, submit = false) => {
    const { kqvlMap } = this.state;

    const kqvlMapNew = { ...kqvlMap, [changeFacet.key]: [changeFacet.key, query, value, changeFacet.label] };
    if (!value) {
      kqvlMapNew[changeFacet.key] = null;
      delete kqvlMapNew[changeFacet.key];
    }

    this.setState({ kqvlMap: kqvlMapNew }, () => {
      if (submit) {
        this.handleSubmit();
      }
    });
  };

  handleSubmit = () => {
    const {
      facet: { key: facetKeys },
      onChange,
    } = this.props;
    const { kqvlMap } = this.state;

    const kqvlList = facetKeys
      .map((k) => {
        return kqvlMap[k] && kqvlMap[k][1] ? kqvlMap[k] : null;
      })
      .filter((x) => !!x);

    onChange(
      this.applyInversion(kqvlList.map((kqvl) => kqvl[1])),
      kqvlList.map((kqvl) => [kqvl[0], kqvl[3], kqvl[2]].join(JOIN_STR)) // key___label___value
    );
  };

  applyInversion(query) {
    if (this.props.inverted) return { bool: { must_not: query } };
    return query;
  }

  async getQuery(values = []) {
    if (values.length) {
      const qList = [];
      values.forEach(async (valStr) => {
        const pieces = valStr.split(JOIN_STR);
        const k = pieces[0];
        // const l = pieces[1];
        const v = pieces[2];
        const ref = this.kRefMap[k];
        const q = await ref.current.getQuery([v]);
        qList.push(q);
      });
      return qList;
    }
    return null;
  }

  render() {
    const {
      facet: { placeholder, labels, key, ...rest },
      baseQueries,
      groupResults,
    } = this.props;
    const { kqvlMap } = this.state;

    const facetsValuePairs = [];

    try {
      // assume labels, key, and placeholder are all equal length arrays
      // if they're not, this should cause an error caught below
      labels.forEach((l, i) => {
        facetsValuePairs.push([
          {
            ...rest,
            label: labels[i],
            key: key[i],
            dataField: key[i],
            placeholder: placeholder ? placeholder[i] : null,
          },
          kqvlMap[key[i]] ? kqvlMap[key[i]][2] : [''],
        ]);
      });
    } catch (_err) {
      console.warn('Error in MultiValueInputFacet: Arrays required');
      return null;
    }

    return (
      <>
        {facetsValuePairs.map((fv, i) => (
          <div key={`facet_${fv[0].key}_${i}`} className={FacetSearchStyles.multivalueinputrow}>
            <InputFacet
              noSearchButton
              baseQueries={baseQueries}
              groupResults={groupResults}
              facet={fv[0]}
              values={fv[1]}
              onChange={(q, v) => this.onInputFacetChange(fv[0], q, v, true)}
              onInputChange={(q, v) => this.onInputFacetChange(fv[0], q, v, false)}
              ref={this.kRefMap[fv[0].key]}
            />
          </div>
        ))}
        <Tooltip overlay="Search" placement="top">
          <Button
            variant="secondary"
            type="submit"
            full
            text="Search"
            onClick={this.handleSubmit}
            className={FacetSearchStyles.fullSearchButton}
          />
        </Tooltip>
      </>
    );
  }
}

MultiValueInputFacet.defaultProps = {
  values: [],
  baseQueries: [],
  onInputChange: () => {},
};

MultiValueInputFacet.propTypes = {
  baseQueries: PropTypes.array,
  facet: PropTypes.object.isRequired,
  groupResults: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  onInputChange: PropTypes.func,
  values: PropTypes.array,
};

export default MultiValueInputFacet;

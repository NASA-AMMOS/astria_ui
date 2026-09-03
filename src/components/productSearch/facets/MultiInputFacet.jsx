import InputFacet from 'src/components/productSearch/facets/InputFacet';

class MultiInputFacet extends InputFacet {
  async getQuery(values = []) {
    const {
      facet: { dataField, dataType },
      inverted,
    } = this.props;
    const value = values[0];
    const mustOrMustNot = inverted ? 'must_not' : 'must';

    if (dataType === 'number') {
      return values.length
        ? {
            bool: {
              [mustOrMustNot]: {
                terms: { [dataField]: values },
              },
            },
          }
        : null;
    }
    const escapedValue = value
      ? value
          .replaceAll('/', '\\/') // escape slashes
          .replaceAll(' ', '* OR ') // join multi-word search
      : ''; // only need to replace forward slashes
    // Otherwise assume it's a string
    const query = {
      bool: {
        [mustOrMustNot]: {
          query_string: {
            query: `${escapedValue}*`,
            fields: dataField,
          },
        },
      },
    };
    return value ? query : null;
  }
}

export default MultiInputFacet;

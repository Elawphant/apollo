


const withScalar = (value: unknown, customScalar: string | Object, nonNullable: boolean) => {

    const __registerScalar = (queryParamName: string, variableName: string) => {
        const nonNull = nonNullable ? '!' : '';
        return {
            queryParamName: queryParamName,
            variableName: variableName,
            scalarType: typeof customScalar === 'string' ? `${customScalar}${nonNull}` : `${customScalar.constructor.name}${nonNull}`,
            value: value,
        };
    };
    return __registerScalar;
};

export { withScalar };
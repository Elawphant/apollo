// TODO: CONSIDER REMOVING THIS FILE

export const PaginationKeyArgs = [
  '__typename',
  'after',
  'before',
  'first',
  'last',
  'offset',
];

export const PageInfoFields = `
  hasNextPage
  hasPreviousPage
  startCursor
  endCursor
`;

export const PageInfoFragment = `
    fragment PageInfoFields on PageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor  
    }
`;

export const PageInfoArgs = {
  first: 'Int',
  last: 'Int',
  before: 'String',
  after: 'String',
  offset: 'Int',
};

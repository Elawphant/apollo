export const PaginationKeyArgs = [
  'first',
  'last',
  'before',
  'after',
  'offset',
  'id',
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

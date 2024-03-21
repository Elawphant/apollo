const ADDON_PREFIX = 'Tir';
const ERROR_MESSAGE_PREFIX = `${ADDON_PREFIX}: `;

// TODO: DEPRECATE
declare const NAMING_CONVENTIONS: {
  item: string;
  set: string;
};

type EnvConfig = {
  endpoint: string;
  namingConventions: typeof NAMING_CONVENTIONS; // TODO deprecate, because using composer
  errorPolicy: 'none' | 'ignore' | 'all'; // TODO: Deprecate, because we are going to use ember request
};

export {
  ADDON_PREFIX,
  ERROR_MESSAGE_PREFIX,
  NAMING_CONVENTIONS,
  type EnvConfig,
};

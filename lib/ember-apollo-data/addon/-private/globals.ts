const ADDON_PREFIX = "Tir";

const ERROR_MESSAGE_PREFIX = `${ADDON_PREFIX}`;

const NAMING_CONVENTIONS = {
    item: "Pod",
    set: "Stem",
};

type EnvConfig = {
    endpoint: string,
    namingConventions: typeof NAMING_CONVENTIONS,
};

export { ADDON_PREFIX, ERROR_MESSAGE_PREFIX, NAMING_CONVENTIONS, type EnvConfig };
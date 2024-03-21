function comparePaths(
  arr1: (string | number)[],
  arr2: (string | number)[],
): boolean {
  if (arr1.length !== arr2.length) {
    return false;
  }

  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) {
      return false; // As soon as one element is different, return false
    }
  }

  return true;
}

export { comparePaths };

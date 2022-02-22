export const randomString = (length: number) =>
  Math.random()
    .toString(36)
    .substr(2, length)
    .split("")
    .map((e) =>
      Math.random() < (Math.random() as number) ? e.toUpperCase() : e
    )
    .join()
    .replaceAll(",", "");

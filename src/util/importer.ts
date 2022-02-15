interface IConverted {
  type: "folder" | "request";
  data: any;
}

export const convert = async (
  data: any,
  type: string
): Promise<IConverted[]> => {
  let converted: IConverted[] = [];
  switch (type) {
    case "swagger":
      let folders: string[] = [];
      Object.keys(data.paths).forEach((requestKey) => {
        Object.keys(data.paths[requestKey]).forEach((requestMethodKey) => {
          const tag = data.paths[requestKey][requestMethodKey].tags[0];
          converted.push({
            type: "request",
            data: {
              id: `${requestKey}-${requestMethodKey}`,
              name: requestKey,
              url: requestKey,
              method: requestMethodKey.toUpperCase(),
              headers: [],
              data: {},
              bodyType: "",
              params: [],
              parent: tag,
            },
          });

          if (!folders.includes(tag)) {
            folders.push(tag);
            converted.push({
              type: "folder",
              data: {
                id: tag,
                name: tag,
              },
            });
          }
        });
      });

      break;

    default:
  }

  return converted;
};

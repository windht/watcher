import cuid from "cuid";

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
              data: {
                mode: "raw",
                raw: "{}",
              },
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

    case "postman":
      const paramsTransform = (params: any) => ({
        key: params.key,
        value: params.value,
        active: !params.disabled,
        description: params.description,
      });

      data.item.forEach((folder: any) => {
        const folderId = cuid();
        converted.push({
          type: "folder",
          data: {
            id: folderId,
            name: folder.name,
          },
        });

        (folder.item || []).forEach((item: any) => {
          const requestId = cuid();
          converted.push({
            type: "request",
            data: {
              id: requestId,
              name: item.name,
              url: item.request.url.raw,
              method: item.request.method.toUpperCase(),
              headers: (item.request.headers || []).map(paramsTransform),
              data: {
                mode: item.request.body?.mode,
                raw: item.request.body?.raw || "{}",
                formdata: (item.request.body?.formdata || []).map(
                  paramsTransform
                ),
              },
              params: [],
              parent: folderId,
            },
          });
        });
      });
      break;

    default:
  }

  return converted;
};

import { http } from "@tauri-apps/api";
import { IRequest } from "store/RequestStore";

export const doRequest = async (request: IRequest, environment: any[]) => {
  console.log("Doing request", request);

  const processString = (value: string) => {
    return value.replace(/{{(.+?)}}/g, (_, g1) => {
      const matchedVariable = environment.find(
        (variable) => variable.key === g1 && !!variable.active
      );
      if (matchedVariable) {
        return matchedVariable.current_value || matchedVariable.initial_value;
      } else {
        return "";
      }
    });
  };

  const transformParamsListToObject = (params: any) => {
    return params.reduce((acc: any, item: any) => {
      return {
        ...acc,
        [item.key]: processString(item.value),
      };
    }, {});
  };

  const getBody = (data: IRequest["data"]) => {
    if (data.mode === "raw") {
      return {
        type: "Json",
        payload: JSON.parse(request.data.raw),
      };
    } else {
      return {
        type: "Form",
        payload: transformParamsListToObject(data.formdata),
      };
    }
  };

  const data = await http.fetch(processString(request.url), {
    method: request.method as any,
    headers: request.headers.reduce(
      (acc, header) => ({
        ...acc,
        [header.key]: processString(header.value),
      }),
      {}
    ),
    query: request.params.reduce(
      (acc, params) => ({
        ...acc,
        [params.key]: processString(params.value),
      }),
      {}
    ),
    body: getBody(request.data),
  });
  return data;

  // return axios({
  //   method: request.method,
  //   headers: request.headers.reduce(
  //     (acc, header) => ({
  //       ...acc,
  //       [header.key]: header.value,
  //     }),
  //     {}
  //   ),
  //   url: request.url,
  //   data: JSON.parse(request.data),
  // });
};

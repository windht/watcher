import { http } from "@tauri-apps/api";
import { IRequest } from "store/RequestStore";

export const doRequest = async (request: IRequest) => {
  console.log("Doing request", request);
  try {
    const data = await http.fetch(request.url, {
      method: request.method as any,
      headers: request.headers.reduce(
        (acc, header) => ({
          ...acc,
          [header.key]: header.value,
        }),
        {}
      ),
      query: request.params.reduce(
        (acc, params) => ({
          ...acc,
          [params.key]: params.value,
        }),
        {}
      ),
      body: {
        type: "Json",
        payload: JSON.parse(request.data),
      },
    });
    return data;
  } catch (err) {
    console.log(err);
  }

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

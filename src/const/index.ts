import { IRequest } from "store/RequestStore";

export const EMPTY_REQUEST: IRequest = {
  id: "",
  url: "",
  method: "GET",
  headers: [],
  data: "{}",
  params: [],
  name: "New Request",
  bodyType: "",
};

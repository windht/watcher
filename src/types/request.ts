import { Method } from "axios";

export interface IHeader {
  active: boolean;
  key: string;
  value: string;
  description: string;
}

export interface IParams {
  active: boolean;
  key: string;
  value: string;
  description: string;
}

export interface IBody {
  mode: "raw" | "formdata";
  formdata?: IParams[];
  options?: any;
  raw?: any;
}

export interface IRequest {
  id: string;
  name: string;
  url: string;
  method: Method;
  headers: IHeader[];
  data: IBody;
  params: IParams[];

  preRequestScript?: string;
  afterRequestScript?: string;
}

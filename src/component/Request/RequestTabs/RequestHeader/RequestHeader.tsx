import React from "react";
import { RequestParamsList } from "../RequestParamsList";

type Props = {};

export const RequestHeader = (props: Props) => {
  return <RequestParamsList fieldName="headers" />;
};

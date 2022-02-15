import React from "react";
import { Input } from "@chakra-ui/react";
import { Field, FieldProps } from "formik";

type Props = {};

export const RequestUrl = (props: Props) => {
  return (
    <Field
      name="url"
      render={({ field }: FieldProps) => (
        <Input
          {...field}
          type="text"
          placeholder="Enter API Endpoint (http(s)://)"
        />
      )}
    />
  );
};

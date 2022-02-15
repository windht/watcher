import { Input } from "@chakra-ui/react";
import { Field, FieldProps } from "formik";
import React from "react";

type Props = {};

export const RequestName = (props: Props) => {
  return (
    <Field
      name="name"
      render={({ field }: FieldProps) => (
        <Input {...field} type="text" placeholder="" />
      )}
    />
  );
};

import React from "react";
import { Field, FieldProps } from "formik";
import { Select } from "@chakra-ui/react";

type Props = {};

const METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"];

export const RequestMethod = (props: Props) => {
  return (
    <Field name="method">
      {({ field }: FieldProps) => (
        <Select w={'200px'} name="method" onChange={field.onChange} value={field.value}>
          {METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
};

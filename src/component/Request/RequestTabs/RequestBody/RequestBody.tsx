import React from "react";
import { Field, FieldProps, useFormikContext } from "formik";
import AutoSizer from "react-virtualized/dist/commonjs/AutoSizer";
import AceEditor from "react-ace";
import { Box } from "@chakra-ui/react";

type Props = {};

export const RequestBody = (props: Props) => {
  const { setFieldValue } = useFormikContext();

  return (
    <AutoSizer>
      {({ height, width }) => (
        <Field name="data">
          {({ field }: FieldProps) => (
            <Box>
              <AceEditor
                value={
                  typeof field.value === "object"
                    ? JSON.stringify(field.value)
                    : field.value || "{}"
                }
                width={`${width}px`}
                height={`${height}px`}
                mode="json"
                theme="tomorrow_night"
                onChange={(value) => {
                  setFieldValue("data", value);
                }}
                name="data"
                editorProps={{ $blockScrolling: true }}
                setOptions={{
                  useWorker: false,
                }}
              />
            </Box>
          )}
        </Field>
      )}
    </AutoSizer>
  );
};

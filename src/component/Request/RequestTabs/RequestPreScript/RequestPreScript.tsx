import React from "react";
import { Box, Flex } from "@chakra-ui/react";
import { Field, FieldProps, useFormikContext } from "formik";
import { AutoSizer } from "react-virtualized";
import AceEditor from "react-ace";

type Props = {};

export const RequestPreScript = (props: Props) => {
  const { setFieldValue } = useFormikContext<any>();
  return (
    <Flex w="100%" h="100%" flexDir={"column"}>
      <AutoSizer>
        {({ height, width }) => (
          <Field name="preRequestScript">
            {({ field }: FieldProps) => (
              <Box>
                <AceEditor
                  value={field.value || ""}
                  width={`${width}px`}
                  height={`${height}px`}
                  mode="javascript"
                  theme="tomorrow_night"
                  onChange={(value) => {
                    setFieldValue("preRequestScript", value);
                  }}
                  name="preRequestScript"
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
    </Flex>
  );
};

import React from "react";
import { Field, FieldProps, useFormikContext } from "formik";
import AutoSizer from "react-virtualized/dist/commonjs/AutoSizer";
import AceEditor from "react-ace";
import { Box, Center, Flex, Radio, RadioGroup, Stack } from "@chakra-ui/react";
import { RequestParamsList } from "../RequestParamsList";

type Props = {};

export const RequestBody = (props: Props) => {
  const { setFieldValue, values } = useFormikContext<any>();

  const mode = values?.data?.mode;

  return (
    <Flex w="100%" h="100%" flexDir={"column"}>
      <RadioGroup
        mb="20px"
        onChange={(mode) => {
          setFieldValue("data.mode", mode);
        }}
        value={mode}
      >
        <Stack gap="20px" paddingX={"20px"} direction="row">
          <Radio value="none">None</Radio>
          <Radio value="raw">raw</Radio>
          <Radio value="formdata">form-data</Radio>
        </Stack>
      </RadioGroup>

      {mode === "raw" && (
        <AutoSizer>
          {({ height, width }) => (
            <Field name="data.raw">
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
                      setFieldValue("data.raw", value);
                    }}
                    name="data.raw"
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
      )}

      {mode === "formdata" && (
        <>
          <RequestParamsList fieldName="data.formdata" />
        </>
      )}

      {mode === "none" && (
        <Center w="100%" padding={"50px"}>
          This request doesn't have a body
        </Center>
      )}
    </Flex>
  );
};

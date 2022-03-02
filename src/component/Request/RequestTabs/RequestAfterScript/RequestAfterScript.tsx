import React, { useCallback, useRef } from "react";
import { Box, Flex } from "@chakra-ui/react";
import { Field, FieldProps, useFormikContext } from "formik";
import { AutoSizer } from "react-virtualized";
import AceEditor from "react-ace";
import { Snippets } from "component/Snippets";

type Props = {};

export const RequestAfterScript = (props: Props) => {
  const { setFieldValue } = useFormikContext<any>();
  const aceEditorRef = useRef<AceEditor>(null);

  const addLine = useCallback(
    (value) => {
      aceEditorRef?.current?.editor?.navigateFileEnd();
      aceEditorRef?.current?.editor?.insert(value);
    },
    [aceEditorRef]
  );

  return (
    <Flex w="100%" h="100%" flexDir={"row"}>
      <Flex flex={1}>
        <AutoSizer>
          {({ height, width }) => (
            <Field name="afterRequestScript">
              {({ field }: FieldProps) => (
                <Box>
                  <AceEditor
                    ref={aceEditorRef}
                    value={field.value || ""}
                    width={`${width}px`}
                    height={`${height}px`}
                    mode="javascript"
                    theme="tomorrow_night"
                    onChange={(value) => {
                      setFieldValue("afterRequestScript", value);
                    }}
                    name="afterRequestScript"
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
      <Flex width={"250px"}>
        <Snippets onClick={addLine} />
      </Flex>
    </Flex>
  );
};

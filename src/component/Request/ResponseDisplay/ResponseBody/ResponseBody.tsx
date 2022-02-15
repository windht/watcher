import { Box } from "@chakra-ui/react";
import { AxiosResponse } from "axios";
import React, { useMemo } from "react";
import AceEditor from "react-ace";
import { AutoSizer } from "react-virtualized";

type Props = {
  response: AxiosResponse;
};

export const ResponseBody = ({ response }: Props) => {
  const dataToDisplay = useMemo(() => {
    try {
      return JSON.stringify(response.data, null, 2);
    } catch {
      return response.data;
    }
  }, [response]);

  return (
    <Box w="100%" h="full">
      <AutoSizer>
        {({ height, width }) => (
          <AceEditor
            value={dataToDisplay}
            width={`${width}px`}
            height={`${height}px`}
            mode="json"
            theme="tomorrow_night"
            onChange={() => {}}
            editorProps={{ $blockScrolling: true }}
            setOptions={{
              useWorker: false,
            }}
          />
        )}
      </AutoSizer>
    </Box>
  );
};

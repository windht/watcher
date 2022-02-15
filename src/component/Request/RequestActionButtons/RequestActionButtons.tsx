import { Button, Flex } from "@chakra-ui/react";
import { useFormikContext } from "formik";
import React from "react";

type Props = {
  makeRequest: any;
};

export const RequestActionButtons = ({ makeRequest }: Props) => {
  const { values, dirty } = useFormikContext();

  const handleClickSend = async () => {
    await makeRequest(values);
  };

  return (
    <Flex gap="10px" flexDir="row">
      <Button onClick={handleClickSend}>Send</Button>
      {dirty && <Button type="submit">Save</Button>}
    </Flex>
  );
};

import { Button, Flex } from "@chakra-ui/react";
import { useFormikContext } from "formik";
import { useTabContext } from "hooks/tab";
import React from "react";

type Props = {
  makeRequest: any;
};

export const RequestActionButtons = ({ makeRequest }: Props) => {
  const { values } = useFormikContext();
  const { isDirty } = useTabContext();
  const handleClickSend = async () => {
    await makeRequest(values);
  };

  return (
    <Flex gap="10px" flexDir="row">
      <Button onClick={handleClickSend}>Send</Button>
      {isDirty && <Button type="submit">Save</Button>}
    </Flex>
  );
};

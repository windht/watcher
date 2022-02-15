import React from "react";
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableCaption,
} from "@chakra-ui/react";
import { AxiosResponse } from "axios";

type Props = {
  response: AxiosResponse;
};

export const ResponseHeader = ({ response }: Props) => {
  return (
    <Table variant="simple">
      <TableCaption></TableCaption>
      <Thead>
        <Tr>
          <Th>KEY</Th>
          <Th>VALUE</Th>
        </Tr>
      </Thead>
      <Tbody>
        {Object.keys(response.headers).map((headerKey) => (
          <Tr key={headerKey}>
            <Td>{headerKey}</Td>
            <Td>{response.headers[headerKey]}</Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
};

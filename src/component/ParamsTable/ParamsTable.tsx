import React, { useMemo } from "react";
import { Box, Center, Checkbox, Flex, Input } from "@chakra-ui/react";
import { Field, FieldArray, FieldProps, useFormikContext } from "formik";
import { FaTrash } from "react-icons/fa";
import get from "lodash.get";

interface IColumn {
  key: string;
  label: string;
}

type Props = {
  fieldName: string;
  columns: IColumn[];
};

export const ParamsTable = ({ fieldName, columns }: Props) => {
  const { values, setFieldValue } = useFormikContext<any>();
  const fields = useMemo(() => {
    const originalFields = get(values, fieldName) || [];
    return [...originalFields, {}];
  }, [values, fieldName]);

  return (
    <FieldArray
      name={fieldName}
      render={({ move, swap, push, insert, unshift, pop, remove }) => (
        <Flex
          w="100%"
          flexDir={"column"}
          borderTopWidth="1px"
          borderTopColor="gray.600"
        >
          <Flex
            flexDir={"row"}
            borderBottomWidth="1px"
            borderBottomColor="gray.600"
          >
            <Box
              p="10px"
              w="50px"
              borderRightWidth="1px"
              borderRightColor="gray.600"
            ></Box>
            {columns.map((column) => (
              <Box
                key={column.key}
                p="10px"
                flex={1}
                borderRightWidth="1px"
                borderRightColor="gray.600"
              >
                {column.label}
              </Box>
            ))}
            <Box mx="10px" w={"30px"}></Box>
          </Flex>

          {fields.map((value: any, index: number) => (
            <Flex
              key={index}
              position={"relative"}
              flexDir={"row"}
              borderBottomWidth="1px"
              borderBottomColor="gray.600"
            >
              <Box
                p="10px"
                w="50px"
                borderRightWidth="1px"
                borderRightColor="gray.600"
              >
                <Field name={`${fieldName}.${index}.active`}>
                  {({ field }: FieldProps) => (
                    <Checkbox
                      isChecked={field.value}
                      onChange={field.onChange}
                    />
                  )}
                </Field>
              </Box>
              {columns.map((column) => (
                <Box
                  key={column.key}
                  p="10px"
                  flex={1}
                  borderRightWidth="1px"
                  borderRightColor="gray.600"
                >
                  <Field name={`${fieldName}.${index}.${column.key}`}>
                    {({ field }: FieldProps) => (
                      <Input
                        type="text"
                        name={field.name}
                        onChange={(event) => {
                          if (index === fields.length - 1) {
                            setFieldValue(`${fieldName}.${index}.active`, true);
                          }
                          field.onChange(event);
                        }}
                        value={field.value || ""}
                      ></Input>
                    )}
                  </Field>
                </Box>
              ))}

              <Center
                mx="10px"
                w={"30px"}
                onClick={() => {
                  remove(index);
                }}
              >
                <FaTrash />
              </Center>
            </Flex>
          ))}
        </Flex>
      )}
    />
  );
};

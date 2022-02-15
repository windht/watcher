import { Box, Checkbox, Flex, Input } from "@chakra-ui/react";
import { Field, FieldArray, FieldProps, useFormikContext } from "formik";
import React, { useMemo } from "react";

type Props = {
  fieldName: string;
};

export const RequestParamsList = ({ fieldName }: Props) => {
  const { values, setFieldValue } = useFormikContext<any>();
  const fields = useMemo(() => {
    const originalFields = values[fieldName] || [];
    return [...originalFields, {}];
  }, [values, fieldName]);

  return (
    <FieldArray
      name={fieldName}
      render={({ move, swap, push, insert, unshift, pop, remove }) => (
        <Flex flexDir={"column"} borderTopWidth="1px" borderTopColor="gray.600">
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
            <Box
              p="10px"
              flex={1}
              borderRightWidth="1px"
              borderRightColor="gray.600"
            >
              KEY
            </Box>

            <Box
              p="10px"
              flex={1}
              borderRightWidth="1px"
              borderRightColor="gray.600"
            >
              VALUE
            </Box>
            <Box
              p="10px"
              flex={1}
              borderRightWidth="1px"
              borderRightColor="gray.600"
            >
              DESCRIPTION
            </Box>
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
              <Box
                p="10px"
                flex={1}
                borderRightWidth="1px"
                borderRightColor="gray.600"
              >
                <Field name={`${fieldName}.${index}.key`}>
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

              <Box
                p="10px"
                flex={1}
                borderRightWidth="1px"
                borderRightColor="gray.600"
              >
                <Field name={`${fieldName}.${index}.value`}>
                  {({ field }: FieldProps) => (
                    <Input
                      {...field}
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
              <Box
                p="10px"
                flex={1}
                borderRightWidth="1px"
                borderRightColor="gray.600"
                position={"relative"}
              >
                <Flex alignItems="center" flexDir={"row"}>
                  <Field name={`${fieldName}.${index}.description`}>
                    {({ field }: FieldProps) => (
                      <Input
                        {...field}
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
                  <Box
                    mx="10px"
                    onClick={() => {
                      remove(index);
                    }}
                  >
                    X
                  </Box>
                </Flex>
              </Box>
            </Flex>
          ))}
        </Flex>
      )}
    />
  );
};

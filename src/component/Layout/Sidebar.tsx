import { Flex, Text } from "@chakra-ui/react";
import React from "react";
import { VscCode, VscHistory } from "react-icons/vsc";
import { Link } from "react-router-dom";

type Props = {};

const NavItems = [
  {
    title: "APIs",
    icon: VscCode,
    href: "/api-list",
  },
  {
    title: "History",
    icon: VscHistory,
    href: "/history",
  },
];

export const Sidebar = (props: Props) => {
  return (
    <>
      {NavItems.map((item) => (
        <Link key={item.href} to={item.href}>
          <Flex
            cursor={"pointer"}
            my="10px"
            flexDir={"column"}
            alignItems={"center"}
          >
            {React.createElement(item.icon, {
              size: "25px",
            })}
            <Text>{item.title}</Text>
          </Flex>
        </Link>
      ))}
    </>
  );
};

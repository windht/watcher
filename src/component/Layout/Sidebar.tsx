import { Flex, Text } from "@chakra-ui/react";
import React from "react";
import { VscCode, VscServerEnvironment } from "react-icons/vsc";
import { Link, useLocation } from "react-router-dom";

type Props = {};

const NavItems = [
  {
    title: "APIs",
    icon: VscCode,
    href: "/api-list",
  },
  {
    title: "Environment",
    icon: VscServerEnvironment,
    href: "/environment",
  },
  // {
  //   title: "History",
  //   icon: VscHistory,
  //   href: "/history",
  // },
];

export const Sidebar = (props: Props) => {
  const location = useLocation();

  return (
    <>
      {NavItems.map((item) => (
        <Link key={item.href} to={item.href}>
          <Flex
            cursor={"pointer"}
            flexDir={"column"}
            alignItems={"center"}
            py="10px"
            borderLeft={
              location.pathname === item.href ? "2px solid orange" : "none"
            }
            bg={location.pathname === item.href ? "gray.600" : "transparent"}
          >
            {React.createElement(item.icon, {
              size: "25px",
            })}
            <Text fontSize={"12px"}>{item.title}</Text>
          </Flex>
        </Link>
      ))}
    </>
  );
};

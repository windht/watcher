import React from "react";
import { DragLayerMonitorProps } from "@minoru/react-dnd-treeview";
import { CustomData } from "./type";
import { RequestNode } from "./RequestNode";

type Props = {
  monitorProps: DragLayerMonitorProps<CustomData>;
};

export const CustomDragPreview: React.FC<Props> = (props) => {
  const item = props.monitorProps.item;

  return (
    <div>
      {item.data?.type === "request" ? (
        <RequestNode node={props.monitorProps.item} id={item.data.requestId!} />
      ) : (
        <div>{`${item.text}`}</div>
      )}
    </div>
  );
};

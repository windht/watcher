import { TabContext } from "component/Tabs/context";
import cuid from "cuid";
import { useCallback, useContext } from "react";
import { useStore } from "store/RootStore";
import { ITab, TabStatusEnum } from "store/TabStore";
import { IRequest } from "types/request";

export const useTabContext = () => {
  const context = useContext(TabContext);
  return context;
};

export const useTabsArray = () => {
  const { tabStore, directoryStore } = useStore();
  return (
    tabStore.tabsByDirectoryId?.[directoryStore.selectedDirectoryId]?.tabs || []
  );
};

export const useTabs = () => {
  const { tabStore, directoryStore } = useStore();
  return (
    (
      tabStore.tabsByDirectoryId?.[directoryStore.selectedDirectoryId]?.tabs ||
      []
    ).map(
      (tabId) =>
        tabStore.tabsByDirectoryId[directoryStore.selectedDirectoryId]
          ?.tabsById?.[tabId]
    ) || []
  );
};

export const useSelectedTab = () => {
  const { tabStore, directoryStore } = useStore();
  const selectedTabId = tabStore.selectedTabId;
  return selectedTabId
    ? tabStore.tabsByDirectoryId?.[directoryStore.selectedDirectoryId]
        ?.tabsById?.[selectedTabId]
    : null;
};

export const useTabsMapUpdate = () => {
  const { tabStore, directoryStore } = useStore();
  const directoryId = directoryStore.selectedDirectoryId;
  const update = useCallback(
    (id, tab) => {
      tabStore.updateTabsMap(directoryId, id, tab);
    },
    [tabStore, directoryId]
  );
  return {
    update,
  };
};

export const useTabsArrayUpdate = () => {
  const { tabStore, directoryStore } = useStore();
  const directoryId = directoryStore.selectedDirectoryId;
  const update = useCallback(
    (tabs) => {
      tabStore.updateTabsArray(directoryId, tabs);
    },
    [tabStore, directoryId]
  );
  return {
    update,
  };
};

export const useSingleTabUpdate = () => {
  const { tabStore, directoryStore } = useStore();
  const directoryId = directoryStore.selectedDirectoryId;
  const updateTab = useCallback(
    (tab) => {
      tabStore.updateTabsMap(directoryId, tab.id, tab);
    },
    [directoryId, tabStore]
  );

  return {
    update: updateTab,
  };
};

export const useTabUtil = () => {
  const { tabStore, directoryStore } = useStore();
  const directoryId = directoryStore.selectedDirectoryId;

  const { update: updateTabsArray } = useTabsArrayUpdate();
  const { update: updateTabsMap } = useTabsMapUpdate();

  const tabs = useTabs();
  const tabsArray = useTabsArray();
  const addAndSelectTab = useCallback(
    (tab: Omit<ITab, "id">) => {
      const newTabsArray = [...tabsArray];
      const existingTab = tabs.find(
        (_tab) => _tab.type === tab.type && _tab.data?.id === tab.data?.id
      );
      if (existingTab) {
        tabStore.setSelectedTabId(existingTab.id);
      } else {
        const id = cuid();
        newTabsArray.push(id);
        updateTabsArray(newTabsArray);
        updateTabsMap(id, {
          id,
          ...tab,
        });
        tabStore.setSelectedTabId(id);
      }
    },
    [tabs, tabStore, tabsArray, updateTabsArray, updateTabsMap]
  );

  const addAndSelectRequest = useCallback(
    (request: IRequest) => {
      addAndSelectTab({
        type: "request",
        data: request,
        currentData: request,
        status: TabStatusEnum.NEW,
      });
    },
    [addAndSelectTab]
  );

  const closeTab = useCallback(
    (tabId: string) => {
      const newTabs = [...tabsArray];
      const existingTabIndex = newTabs.findIndex((_tabId) => _tabId === tabId);
      if (existingTabIndex !== -1) {
        newTabs.splice(existingTabIndex, 1);
      }
      updateTabsArray(newTabs);
      tabStore.removeTabsMap(directoryId, tabId);

      if (newTabs.length > 0) {
        if (existingTabIndex === 0) {
          tabStore.setSelectedTabId(newTabs[0]);
        } else {
          tabStore.setSelectedTabId(newTabs[existingTabIndex - 1]);
        }
      } else {
        tabStore.setSelectedTabId(undefined);
      }
    },
    [tabStore, directoryId, tabsArray, updateTabsArray]
  );

  return {
    addAndSelectTab,
    addAndSelectRequest,
    closeTab,
  };
};

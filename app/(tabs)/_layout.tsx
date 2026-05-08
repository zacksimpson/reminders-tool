import { Tabs } from "expo-router";
import { Navbar, type TabConfigItem } from "@/components/Navbar";
import { SettingsIcon } from "@/components/SettingsIcon";
import { ListsIcon } from "@/components/ListsIcon";

export const TABS_CONFIG: readonly TabConfigItem[] = [
  { name: "LISTS", screenName: "index", customIcon: (color: string) => <ListsIcon color={color} /> },
  { name: "TODAY", screenName: "today", iconName: "today" },
  { name: "ADD", screenName: "add", iconName: "add-circle-outline" },
  { name: "SETTINGS", screenName: "settings", customIcon: (color: string) => <SettingsIcon color={color} /> },
] as const;

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => {
        const activeScreenName = props.state.routes[props.state.index].name;
        return (
          <Navbar
            currentScreenName={activeScreenName}
            navigation={props.navigation}
            tabsConfig={TABS_CONFIG}
          />
        );
      }}
    >
      {TABS_CONFIG.map((tab) => (
        <Tabs.Screen
          key={tab.screenName}
          name={tab.screenName}
          options={{ header: () => null }}
        />
      ))}
    </Tabs>
  );
}

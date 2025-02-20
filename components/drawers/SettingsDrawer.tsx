import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSettingsTab } from "@/components/tabs/GeneralSettingsTab";
import { DesignTab } from "@/components/tabs/DesignTab";
import { AnalyticsTab } from "@/components/tabs/AnalyticsTab";
import { PageData } from "@/types";

interface SettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageDetails: PageData | null;
  setPageDetails: (
    data: PageData | ((prev: PageData | null) => PageData | null)
  ) => void;
  focusField?: 'title' | 'description' | 'image';
}

export function SettingsDrawer({
  open,
  onOpenChange,
  pageDetails,
  setPageDetails,
  focusField,
}: SettingsDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent direction="right">
        <Tabs defaultValue={focusField === 'image' ? 'general' : 'general'}>
          <TabsList className="grid w-full grid-cols-3 sticky top-0">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="design">Design</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <GeneralSettingsTab
              pageDetails={pageDetails}
              setPageDetails={setPageDetails}
              focusField={focusField}
            />
          </TabsContent>
          <TabsContent value="design">
            <DesignTab
              pageDetails={pageDetails}
              setPageDetails={setPageDetails}
            />
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsTab pageDetails={pageDetails} />
          </TabsContent>
        </Tabs>
      </DrawerContent>
    </Drawer>
  );
}

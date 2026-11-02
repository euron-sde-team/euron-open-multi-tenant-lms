"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@open-mtlms/core";
import { useState } from "react";

import { CartTab } from "./tabs/CartTab";
import { CourseAnalyticsTab } from "./tabs/CourseAnalyticsTab";
import { FormsContactTab } from "./tabs/FormsContactTab";
import { LearningTab } from "./tabs/LearningTab";
import { OrdersPaymentsTab } from "./tabs/OrdersPaymentsTab";
import { OverviewTab } from "./tabs/OverviewTab";

interface MemberDetailTabsProps {
  memberId: string;
}

export function MemberDetailTabs({ memberId }: MemberDetailTabsProps) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <div className="overflow-x-auto">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="learning">Learning</TabsTrigger>
          <TabsTrigger value="course-analytics">Course Analytics</TabsTrigger>
          <TabsTrigger value="orders">Orders & Payments</TabsTrigger>
          <TabsTrigger value="cart">Cart</TabsTrigger>
          <TabsTrigger value="forms-contact">Forms & Contact</TabsTrigger>
        </TabsList>
      </div>

      <div className="mt-6">
        <TabsContent value="overview" className="mt-0">
          <OverviewTab memberId={memberId} />
        </TabsContent>
        <TabsContent value="learning" className="mt-0">
          <LearningTab
            memberId={memberId}
            enabled={activeTab === "learning"}
          />
        </TabsContent>
        <TabsContent value="course-analytics" className="mt-0">
          <CourseAnalyticsTab
            memberId={memberId}
            enabled={activeTab === "course-analytics"}
          />
        </TabsContent>
        <TabsContent value="orders" className="mt-0">
          <OrdersPaymentsTab
            memberId={memberId}
            enabled={activeTab === "orders"}
          />
        </TabsContent>
        <TabsContent value="cart" className="mt-0">
          <CartTab
            memberId={memberId}
            enabled={activeTab === "cart"}
          />
        </TabsContent>
        <TabsContent value="forms-contact" className="mt-0">
          <FormsContactTab memberId={memberId} />
        </TabsContent>
      </div>
    </Tabs>
  );
}

import type {
  CreateGatewayPlanParams,
  CreateGatewaySubscriptionParams,
  GatewayPlanResult,
  GatewaySubscriptionDetails,
  GatewaySubscriptionResult,
} from "../subscription-gateway.types";

export interface SubscriptionGatewayAdapter {
  createPlan(params: CreateGatewayPlanParams): Promise<GatewayPlanResult>;
  createSubscription(params: CreateGatewaySubscriptionParams): Promise<GatewaySubscriptionResult>;
  fetchSubscription(gatewaySubscriptionId: string): Promise<GatewaySubscriptionDetails>;
  cancelSubscription(gatewaySubscriptionId: string, cancelAtCycleEnd: boolean): Promise<void>;
  pauseSubscription(gatewaySubscriptionId: string): Promise<void>;
  resumeSubscription(gatewaySubscriptionId: string): Promise<void>;
}

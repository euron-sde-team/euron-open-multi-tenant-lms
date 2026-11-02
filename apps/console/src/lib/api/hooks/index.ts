// Auth hooks
export { useLogin, useLogout } from './useAuth';

// Activity Feed hooks
export { useGetActivityFeed } from './useActivityFeed';

// Audit Log hooks
export type { AuditLogFilters } from './useAuditLogs';
export { useAuditLog, useAuditLogs } from './useAuditLogs';

// Tenant Offerings / Sales / Revenue hooks
export {
  useGetTenantBatches,
  useGetTenantBookDetail,
  useGetTenantBooks,
  useGetTenantBundles,
  useGetTenantCourseDetail,
  useGetTenantCourses,
  useGetTenantOfferingsSummary,
  useGetTenantRevenueSummary,
  useGetTenantSalesOrders,
  useGetTenantTestSeries,
} from './useTenantOfferings';

// Dashboard hooks
export { useGetDashboardStats } from './useDashboard';

// Admin Users hooks
export type { AdminUsersFilters } from './useAdminUsers';
export {
  useAssignRoleToUser,
  useCreateAdminUser,
  useDeactivateAdminUser,
  useDeleteAdminUser,
  useGetAdminUser,
  useGetAdminUsers,
  useReactivateAdminUser,
  useRevokeRoleFromUser,
  useUpdateAdminUser,
} from './useAdminUsers';

// Roles hooks
export type { RolesFilters } from './useRoles';
export {
  useAssignPermissionToRole,
  useCreateRole,
  useDeleteRole,
  useGetRole,
  useGetRoles,
  useRevokePermissionFromRole,
  useUpdateRole,
} from './useRoles';

// Permissions hooks
export type { PermissionsFilters } from './usePermissions';
export {
  useCreatePermission,
  useDeletePermission,
  useGetPermission,
  useGetPermissionCategories,
  useGetPermissions,
  useUpdatePermission,
} from './usePermissions';

// Applications hooks
export type { ApplicationsFilters } from './useApplications';
export {
  useCreateApplication,
  useDeactivateApplication,
  useGetApplication,
  useGetApplications,
  useGetFeaturesByApplication,
  useUpdateApplication,
} from './useApplications';

// Features hooks
export type { FeaturesFilters } from './useFeatures';
export {
  useCreateFeature,
  useDeprecateFeature,
  useGetFeature,
  useGetFeatureCategories,
  useGetFeatures,
  useGetProductsByFeature,
  useUpdateFeature,
} from './useFeatures';

// Products hooks
export type { ProductsFilters } from './useProducts';
export {
  useCreateProduct,
  useGetProduct,
  useGetProducts,
  useUpdateProduct,
} from './useProducts';

// Plans hooks
export type { PlansFilters } from './usePlans';
export {
  useAddProductToVersion,
  useCreatePlan,
  useCreatePlanVersion,
  useCreatePlanWithVersion,
  useDeactivatePlan,
  useGetPlan,
  useGetPlanApplications,
  useGetPlans,
  useGetPlanVersion,
  useGetPlanVersions,
  useLinkApplicationToPlan,
  usePublishPlanVersion,
  useRemoveProductFromVersion,
  useRetirePlanVersion,
  useUnlinkApplicationFromPlan,
  useUpdatePlan,
  useUpdatePlanVersion,
} from './usePlans';

// Tenants hooks
export type {
  TenantApplicationsFilters,
  TenantAuditLogFilters,
  TenantMembersFilters,
  TenantsFilters,
} from './useTenants';
export {
  useCreateTenant,
  useCreateTenantPermission,
  useCreateTenantRole,
  useDeleteTenant,
  useDeleteTenantPermission,
  useGetRolePermissions,
  useGetTenant,
  useGetTenantApplications,
  useGetTenantAuditLogs,
  useGetTenantMembers,
  useGetPermissionCategories as useGetTenantPermissionCategories,
  useGetTenantPermissions,
  useGetTenantRoles,
  useGetTenants,
  useGrantApplicationToTenant,
  useReactivateTenant,
  useSetRolePermissions,
  useSuspendTenant,
  useUpdateTenant,
  useUpdateTenantApplication,
  useUpdateTenantPermission,
  useUpdateTenantRole,
} from './useTenants';

// Tenant Users hooks
export type { TenantUsersFilters } from './useTenantUsers';
export {
  useAssignRoleToTenantUser,
  useCreateTenantUser,
  useGetGlobalUser,
  useGetTenantUser,
  useGetTenantUsers,
  useGetUserTenants,
  useInviteUserToTenant,
  useRemoveUserFromTenant,
  useRevokeRoleFromTenantUser,
  useSearchGlobalTenantUsers,
  useUpdateTenantUser,
  useUpdateUserMembership,
} from './useTenantUsers';

// Subscriptions hooks
export type { SubscriptionsFilters } from './useSubscriptions';
export {
  useCancelSubscription,
  useCreateSubscription,
  useGetAllSubscriptions,
  useGetSubscription,
  useGetSubscriptions,
  useUpgradeSubscription,
} from './useSubscriptions';

// Entitlements hooks
export type { EntitlementsFilters } from './useEntitlements';
export {
  useCheckEntitlement,
  useConsumeEntitlement,
  useCreateAdminEntitlement,
  useGetEntitlement,
  useGetEntitlements,
  useGetOverrideHistory,
  useOverrideEntitlement,
  useReconcileUsage,
  useResetEntitlementUsage,
  useRevokeAdminEntitlement,
  useUpdateEntitlementUsage,
} from './useEntitlements';

// Billing Providers hooks
export {
  useCreateBillingProvider,
  useDeleteBillingProvider,
  useGetBillingProvider,
  useGetBillingProviders,
  useGetBillingProvidersAnalytics,
  useUpdateBillingProvider,
} from './useBillingProviders';

// Addons hooks
export type { AddonsFilters } from './useAddons';
export {
  useCancelTenantAddon,
  useCreateAddon,
  useGetAddon,
  useGetAvailableAddons,
  useGetTenantAddon,
  useGetTenantAddons,
  useGrantAddonToTenant,
  useUpdateAddon,
} from './useAddons';

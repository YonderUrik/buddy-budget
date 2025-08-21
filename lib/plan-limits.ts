export type PlanTier = 'FREE' | 'PRO' | 'LEGACY';

export interface PlanLimits {
  linkedAccounts: number | 'unlimited';
}

export function getPlanLimits(planTier: PlanTier): PlanLimits {
  switch (planTier) {
    case 'FREE':
      return {
        linkedAccounts: 0
      };
    case 'PRO':
      return {
        linkedAccounts: 1
      };
    case 'LEGACY':
      return {
        linkedAccounts: 999999 // effectively unlimited
      };
    default:
      return getPlanLimits('FREE');
  }
}

export function canCreateLinkedAccount(planTier: PlanTier, currentLinkedAccounts: number): boolean {
  const limits = getPlanLimits(planTier);
  console.log('limits', limits);
  console.log('currentLinkedAccounts', currentLinkedAccounts);
  if (limits.linkedAccounts === 'unlimited' || limits.linkedAccounts >= 999999) {
    return true;
  }
  return currentLinkedAccounts < limits.linkedAccounts;
}

export function getRemainingLinkedAccounts(planTier: PlanTier, currentLinkedAccounts: number): number | 'unlimited' {
  const limits = getPlanLimits(planTier);
  if (limits.linkedAccounts === 'unlimited' || limits.linkedAccounts >= 999999) {
    return 'unlimited';
  }
  return Math.max(0, limits.linkedAccounts - currentLinkedAccounts);
}
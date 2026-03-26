export type UserPlan = 'FREE' | 'PRO';

export interface ApiUser {
  id: number;
  apiKey: string;
  plan: UserPlan;
  usageCount: number;
  usageDate: string;
}

export interface UsageInfo {
  id: number;
  plan: UserPlan;
  usage_count: number;
  daily_limit: number;
  remaining: number;
  usage_date: string;
}

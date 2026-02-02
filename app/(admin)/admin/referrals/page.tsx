"use client";

import { MousePointerClick, Share2, TrendingUp, UserPlus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FunnelChart } from "@/components/admin/FunnelChart";
import { HorizontalBarChart } from "@/components/admin/HorizontalBarChart";
import { StatCard } from "@/components/admin/StatCard";
import { Skeleton } from "@/components/ui/skeleton";

interface ReferralsData {
  stats: {
    totalReferrers: number;
    totalClicks: number;
    conversions: number;
    conversionRate: number;
  };
  funnel: {
    clicks: number;
    unique: number;
    signups: number;
  };
  topReferrers: Array<{
    handle: string;
    clicks: number;
    conversions: number;
    rate: string;
  }>;
  sources: Array<{ source: string; percent: number }>;
  recentConversions: Array<{
    newUserEmail: string;
    referrerHandle: string;
    createdAt: string;
  }>;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return "just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const MEDAL_EMOJIS = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];

export default function AdminReferralsPage() {
  const [data, setData] = useState<ReferralsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/referrals");
      if (!res.ok) throw new Error("Failed to fetch");
      const json: ReferralsData = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to fetch referrals:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Share2 className="w-5 h-5 text-slate-400" aria-hidden="true" />
        <span className="text-sm text-slate-500">Referral Program</span>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : (
          <>
            <StatCard
              title="Total Referrers"
              value={data?.stats.totalReferrers ?? 0}
              icon={Share2}
              iconColorClass="text-purple-600"
              iconBgClass="bg-linear-to-r from-purple-100 to-pink-100"
            />
            <StatCard
              title="Total Clicks"
              value={data?.stats.totalClicks ?? 0}
              icon={MousePointerClick}
              iconColorClass="text-indigo-600"
              iconBgClass="bg-linear-to-r from-indigo-100 to-blue-100"
            />
            <StatCard
              title="Conversions"
              value={data?.stats.conversions ?? 0}
              icon={UserPlus}
              iconColorClass="text-emerald-600"
              iconBgClass="bg-linear-to-r from-emerald-100 to-teal-100"
            />
            <StatCard
              title="Conv. Rate"
              value={`${data?.stats.conversionRate ?? 0}%`}
              icon={TrendingUp}
              iconColorClass="text-amber-600"
              iconBgClass="bg-linear-to-r from-amber-100 to-orange-100"
            />
          </>
        )}
      </div>

      {/* Funnel */}
      <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-6">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
          Referral Funnel
        </h2>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : data ? (
          <FunnelChart
            steps={[
              { label: "Clicks", value: data.funnel.clicks },
              { label: "Unique", value: data.funnel.unique },
              { label: "Signups", value: data.funnel.signups },
            ]}
          />
        ) : null}
      </div>

      {/* Top Referrers Table */}
      <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 overflow-hidden">
        <div className="p-6 border-b border-slate-200/60">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
            Top Referrers
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200/60 bg-slate-50/50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  Rank
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  User
                </th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  Clicks
                </th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  Conversions
                </th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  Rate
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-8" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-24" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-12 ml-auto" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-12 ml-auto" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-12 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : !data || data.topReferrers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No referrers yet
                  </td>
                </tr>
              ) : (
                data.topReferrers.map((referrer, i) => (
                  <tr key={referrer.handle} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm">
                      {i < 3 ? (
                        <span className="text-lg">{MEDAL_EMOJIS[i]}</span>
                      ) : (
                        <span className="text-slate-400 pl-1">{i + 1}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/${referrer.handle}`}
                        target="_blank"
                        className="text-sm text-indigo-600 hover:text-indigo-800"
                      >
                        @{referrer.handle}
                      </Link>
                    </td>
                    <td
                      className="px-4 py-3 text-right text-sm text-slate-900"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {referrer.clicks.toLocaleString()}
                    </td>
                    <td
                      className="px-4 py-3 text-right text-sm text-slate-900 font-medium"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {referrer.conversions}
                    </td>
                    <td
                      className="px-4 py-3 text-right text-sm text-slate-600"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {referrer.rate}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Click Sources */}
        <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Click Sources
          </h2>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-6" />
              ))}
            </div>
          ) : (
            <HorizontalBarChart
              items={
                data?.sources.map((s) => ({
                  label: s.source.charAt(0).toUpperCase() + s.source.slice(1),
                  value: 0,
                  percent: s.percent,
                })) ?? []
              }
              colorClass="bg-purple-500"
            />
          )}
        </div>

        {/* Recent Conversions */}
        <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 p-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Recent Conversions
          </h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : data?.recentConversions.length === 0 ? (
            <p className="text-sm text-slate-400">No conversions yet</p>
          ) : (
            <div className="space-y-3">
              {data?.recentConversions.map((conv, i) => (
                <div
                  key={`${conv.newUserEmail}-${i}`}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-slate-600 truncate block">{conv.newUserEmail}</span>
                    <span className="text-slate-400">
                      via{" "}
                      <Link
                        href={`/${conv.referrerHandle}`}
                        target="_blank"
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        @{conv.referrerHandle}
                      </Link>
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 ml-2">
                    {formatRelativeTime(conv.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  CheckCircle2,
  Mail,
  MessageSquare,
  MousePointerClick,
  Send,
  Users,
  AlertTriangle,
  AlertCircle,
  Target,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import GlassCard from "@/components/GlassCard";
import AnimatedNumber from "@/components/AnimatedNumber";
import { call } from "@/lib/api";
import { timeAgo } from "@/lib/utils";

type Totals = {
  campaigns: number;
  leads: number;
  sent: number;
  delivered: number;
  bounced: number;
  clicked: number;
  replied: number;
};

type CampaignRow = {
  id: string;
  name: string;
  created_at?: string;
  leads_imported?: number;
  emails_sent?: number;
  emails_delivered?: number;
  emails_bounced?: number;
  emails_clicked?: number;
  emails_replied?: number;
};

export default function Analytics() {
  const [totals, setTotals] = useState<Totals | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, []);

  async function refresh() {
    try {
      const { totals, campaigns } = await call<{ totals: Totals; campaigns: CampaignRow[] }>(
        "outreach.analytics.summary",
      );
      setTotals(totals);
      setCampaigns(campaigns);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    }
  }

  function pct(num: number, denom: number) {
    if (!denom) return "—";
    return `${Math.round((num / denom) * 100)}%`;
  }

  const deliverabilityHealthy = totals ? totals.bounced / Math.max(1, totals.sent) < 0.05 : true;

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Live flywheel across all your outreach. Counters tick in real time as AgentMail webhooks fire."
      />

      {err && (
        <GlassCard className="mb-5 border-red-200 bg-red-50">
          <div className="flex items-center gap-3 text-red-700">
            <AlertCircle size={18} />
            <span className="text-sm font-medium">{err}</span>
          </div>
        </GlassCard>
      )}

      {/* Top-line flywheel */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <StatTile label="Campaigns" value={totals?.campaigns ?? 0} icon={<Target size={16} />} tint="primary" />
        <StatTile label="Leads" value={totals?.leads ?? 0} icon={<Users size={16} />} tint="primary" />
        <StatTile label="Sent" value={totals?.sent ?? 0} icon={<Send size={16} />} tint="purple" />
        <StatTile label="Delivered" value={totals?.delivered ?? 0} icon={<CheckCircle2 size={16} />} tint="green" />
        <StatTile label="Bounced" value={totals?.bounced ?? 0} icon={<AlertTriangle size={16} />} tint="red" />
        <StatTile label="Clicks" value={totals?.clicked ?? 0} icon={<MousePointerClick size={16} />} tint="accent" />
        <StatTile label="Replies" value={totals?.replied ?? 0} icon={<MessageSquare size={16} />} tint="green" />
      </div>

      {/* Conversion ratios */}
      {totals && totals.sent > 0 && (
        <GlassCard className="mb-6 bg-gradient-to-br from-primary/[0.04] to-purple/[0.04]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <RatioTile label="Delivery rate" value={pct(totals.delivered, totals.sent)} sub={`${totals.delivered} of ${totals.sent}`} />
            <RatioTile label="Click rate" value={pct(totals.clicked, totals.sent)} sub={`${totals.clicked} of ${totals.sent}`} />
            <RatioTile label="Reply rate" value={pct(totals.replied, totals.sent)} sub={`${totals.replied} of ${totals.sent}`} />
            <RatioTile
              label="Bounce rate"
              value={pct(totals.bounced, totals.sent)}
              sub={`${totals.bounced} of ${totals.sent}`}
              warn={!deliverabilityHealthy}
            />
          </div>
          {!deliverabilityHealthy && (
            <div className="mt-4 pt-4 border-t border-red-200 flex items-center gap-2 text-xs text-red-600">
              <AlertTriangle size={14} />
              Bounce rate is elevated. Review lead quality before scaling sends.
            </div>
          )}
        </GlassCard>
      )}

      {/* Per-campaign breakdown */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={16} className="text-primary" />
          <h3 className="font-display text-sm tracking-widest uppercase text-slate-600 font-bold">Per campaign</h3>
        </div>
        {campaigns.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">
            No campaigns yet. <Link to="/outreach" className="text-primary hover:underline">Create one →</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                  <th className="text-left py-2 pr-2 text-[10px] uppercase tracking-widest text-slate-400 font-bold">Campaign</th>
                  <th className="text-right py-2 px-2 text-[10px] uppercase tracking-widest text-slate-400 font-bold">Leads</th>
                  <th className="text-right py-2 px-2 text-[10px] uppercase tracking-widest text-slate-400 font-bold">Sent</th>
                  <th className="text-right py-2 px-2 text-[10px] uppercase tracking-widest text-slate-400 font-bold">Del.</th>
                  <th className="text-right py-2 px-2 text-[10px] uppercase tracking-widest text-slate-400 font-bold">Bounce</th>
                  <th className="text-right py-2 px-2 text-[10px] uppercase tracking-widest text-slate-400 font-bold">Clicks</th>
                  <th className="text-right py-2 px-2 text-[10px] uppercase tracking-widest text-slate-400 font-bold">Replies</th>
                  <th className="text-right py-2 pl-2 text-[10px] uppercase tracking-widest text-slate-400 font-bold">Created</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 transition">
                    <td className="py-2.5 pr-2">
                      <Link to={`/outreach/${c.id}`} className="text-slate-900 hover:text-primary font-medium truncate block max-w-xs">
                        {c.name}
                      </Link>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-800">{c.leads_imported ?? 0}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-800">{c.emails_sent ?? 0}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-green-300">{c.emails_delivered ?? 0}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-red-600">{c.emails_bounced ?? 0}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-accent">{c.emails_clicked ?? 0}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-green-300">{c.emails_replied ?? 0}</td>
                    <td className="py-2.5 pl-2 text-right text-[11px] text-slate-400 font-mono">{c.created_at ? timeAgo(c.created_at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </>
  );
}

function StatTile({ label, value, icon, tint }: { label: string; value: number; icon: React.ReactNode; tint: "primary" | "purple" | "accent" | "green" | "red" }) {
  const tints: Record<typeof tint, string> = {
    primary: "from-primary/15 to-primary/5 border-primary/25 text-primary",
    purple: "from-purple/15 to-purple/5 border-purple/25 text-purple",
    accent: "from-accent/15 to-accent/5 border-accent/25 text-accent",
    green: "from-green-500/15 to-green-500/5 border-green-500/25 text-green-300",
    red: "from-red-50 to-red-50 border-red-200 text-red-600",
  };
  return (
    <div className={`rounded-xl p-4 bg-gradient-to-br ${tints[tint]} border`}>
      <div className="flex items-center gap-1.5 mb-2 opacity-90">
        {icon}
        <span className="text-[10px] uppercase tracking-widest font-bold">{label}</span>
      </div>
      <div className="font-display text-2xl font-black text-slate-900">
        <AnimatedNumber value={value} />
      </div>
    </div>
  );
}

function RatioTile({ label, value, sub, warn }: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div>
      <div className={`text-[10px] uppercase tracking-widest font-bold mb-1 ${warn ? "text-red-600" : "text-slate-400"}`}>
        {label}
      </div>
      <div className={`font-display text-3xl font-black tabular-nums ${warn ? "text-red-600" : "text-slate-900"}`}>{value}</div>
      <div className="text-[11px] font-mono text-slate-400 mt-0.5">{sub}</div>
    </div>
  );
}

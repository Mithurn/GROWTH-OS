'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

// ============================================
// TYPES
// ============================================

interface IntelligenceBrief {
  generatedAt: string;
  summary: string[];
  keyInsights: string[];
  recommendation: {
    action: string;
    potentialRevenue: number;
  };
}

interface CampaignFunnelData {
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  failed: number;
}

interface OpportunityPipelineData {
  detected: number;
  reviewed: number;
  campaignCreated: number;
  launched: number;
  completed: number;
}

interface ChannelPerformance {
  channel: string;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  deliveryRate: number;
  readRate: number;
  clickRate: number;
}

interface OpportunityDistribution {
  opportunityType: string;
  count: number;
  potentialRevenue: number;
}

interface OpportunityTrendPoint {
  date: string;
  count: number;
}

interface ActivityFeedItem {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

interface RecommendedAction {
  action: string;
  audience: string;
  potentialRevenue: number;
  opportunityId?: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function AnalyticsPage() {
  const [intelligenceBrief, setIntelligenceBrief] = useState<IntelligenceBrief | null>(null);
  const [campaignFunnel, setCampaignFunnel] = useState<CampaignFunnelData | null>(null);
  const [opportunityPipeline, setOpportunityPipeline] = useState<OpportunityPipelineData | null>(null);
  const [channelPerformance, setChannelPerformance] = useState<ChannelPerformance[]>([]);
  const [opportunityDistribution, setOpportunityDistribution] = useState<OpportunityDistribution[]>([]);
  const [opportunityTrend, setOpportunityTrend] = useState<OpportunityTrendPoint[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [recommendedActions, setRecommendedActions] = useState<RecommendedAction[]>([]);

  const [loading, setLoading] = useState(true);
  const [aiAnalystQuery, setAiAnalystQuery] = useState('');

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);

    try {
      const [
        briefRes,
        funnelRes,
        pipelineRes,
        channelRes,
        distRes,
        trendRes,
        feedRes,
        actionsRes,
      ] = await Promise.all([
        fetch('http://localhost:3001/api/analytics/intelligence-brief'),
        fetch('http://localhost:3001/api/analytics/campaign-funnel'),
        fetch('http://localhost:3001/api/analytics/opportunity-pipeline'),
        fetch('http://localhost:3001/api/analytics/channel-performance'),
        fetch('http://localhost:3001/api/analytics/opportunity-distribution'),
        fetch('http://localhost:3001/api/analytics/opportunity-trend'),
        fetch('http://localhost:3001/api/analytics/activity-feed'),
        fetch('http://localhost:3001/api/analytics/recommended-actions'),
      ]);

      const [brief, funnel, pipeline, channel, dist, trend, feed, actions] = await Promise.all([
        briefRes.json(),
        funnelRes.json(),
        pipelineRes.json(),
        channelRes.json(),
        distRes.json(),
        trendRes.json(),
        feedRes.json(),
        actionsRes.json(),
      ]);

      setIntelligenceBrief(brief.data);
      setCampaignFunnel(funnel.data);
      setOpportunityPipeline(pipeline.data);
      setChannelPerformance(channel.data);
      setOpportunityDistribution(dist.data);
      setOpportunityTrend(trend.data);
      setActivityFeed(feed.data);
      setRecommendedActions(actions.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.15),_transparent_35%),linear-gradient(180deg,#fff9ed_0%,#ffffff_40%,#fffdf8_100%)] flex items-center justify-center">
        <div className="text-stone-600 text-xl">Loading Analytics...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.15),_transparent_35%),linear-gradient(180deg,#fff9ed_0%,#ffffff_40%,#fffdf8_100%)] p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-stone-900">AI Growth Intelligence</h1>
            <p className="text-stone-600 mt-1">Real-time insights from your growth agents</p>
          </div>
          <button
            onClick={loadAllData}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
          >
            Refresh
          </button>
        </div>

        {/* 1. AI GROWTH INTELLIGENCE BRIEF */}
        <IntelligenceBriefSection brief={intelligenceBrief} />

        {/* 2. CAMPAIGN FUNNEL + OPPORTUNITY PIPELINE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CampaignFunnelSection funnel={campaignFunnel} />
          <OpportunityPipelineSection pipeline={opportunityPipeline} />
        </div>

        {/* 3. CHANNEL PERFORMANCE + OPPORTUNITY DISTRIBUTION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChannelPerformanceSection channels={channelPerformance} />
          <OpportunityDistributionSection distribution={opportunityDistribution} />
        </div>

        {/* 4. OPPORTUNITY TREND */}
        <OpportunityTrendSection trend={opportunityTrend} />

        {/* 5. ACTIVITY FEED + AI ANALYST */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ActivityFeedSection feed={activityFeed} />
          <AIAnalystSection query={aiAnalystQuery} setQuery={setAiAnalystQuery} />
        </div>

        {/* 6. RECOMMENDED NEXT ACTIONS */}
        <RecommendedActionsSection actions={recommendedActions} />
      </div>
    </div>
  );
}

// ============================================
// SECTION COMPONENTS
// ============================================

function IntelligenceBriefSection({ brief }: { brief: IntelligenceBrief | null }) {
  if (!brief) return null;

  return (
    <div className="bg-white border border-amber-200/80 rounded-2xl p-8 shadow-sm">
      <div className="flex items-start justify-between mb-6">
        <h2 className="text-2xl font-bold text-stone-900">AI Growth Intelligence Brief</h2>
        <span className="text-sm text-stone-500">
          {new Date(brief.generatedAt).toLocaleString()}
        </span>
      </div>

      <div className="space-y-6">
        {/* Summary */}
        <div>
          <h3 className="text-lg font-semibold text-stone-900 mb-3">What Happened</h3>
          <ul className="space-y-2">
            {brief.summary.map((point, i) => (
              <li key={i} className="text-stone-700 flex items-start">
                <span className="mr-2 text-amber-600">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Key Insights */}
        <div>
          <h3 className="text-lg font-semibold text-stone-900 mb-3">What Matters</h3>
          <ul className="space-y-2">
            {brief.keyInsights.map((insight, i) => (
              <li key={i} className="text-stone-700 flex items-start">
                <span className="mr-2">💡</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Recommendation */}
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <h3 className="text-lg font-semibold text-stone-900 mb-2">Recommended Next Action</h3>
          <p className="text-stone-700 mb-3">{brief.recommendation.action}</p>
          <div className="text-2xl font-bold text-stone-900">
            Potential Revenue: ₹{Math.round(brief.recommendation.potentialRevenue).toLocaleString('en-IN')}
          </div>
        </div>
      </div>
    </div>
  );
}

function CampaignFunnelSection({ funnel }: { funnel: CampaignFunnelData | null }) {
  if (!funnel) return null;

  const data = [
    { name: 'Sent', value: funnel.sent },
    { name: 'Delivered', value: funnel.delivered },
    { name: 'Read', value: funnel.read },
    { name: 'Clicked', value: funnel.clicked },
  ];

  return (
    <div className="bg-white border border-amber-200/80 rounded-2xl p-6 shadow-sm">
      <h3 className="text-xl font-bold text-stone-900 mb-4">Campaign Funnel</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis dataKey="name" stroke="#78716c" />
          <YAxis stroke="#78716c" />
          <Tooltip
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #fbbf24', borderRadius: '8px' }}
            labelStyle={{ color: '#1c1917' }}
          />
          <Bar dataKey="value" fill="#f59e0b" />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 text-sm text-stone-600">
        {funnel.failed > 0 && <p>Failed: {funnel.failed}</p>}
      </div>
    </div>
  );
}

function OpportunityPipelineSection({ pipeline }: { pipeline: OpportunityPipelineData | null }) {
  if (!pipeline) return null;

  const data = [
    { name: 'Detected', value: pipeline.detected },
    { name: 'Reviewed', value: pipeline.reviewed },
    { name: 'Campaign Created', value: pipeline.campaignCreated },
    { name: 'Launched', value: pipeline.launched },
    { name: 'Completed', value: pipeline.completed },
  ];

  return (
    <div className="bg-white border border-amber-200/80 rounded-2xl p-6 shadow-sm">
      <h3 className="text-xl font-bold text-stone-900 mb-4">Opportunity Pipeline</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis dataKey="name" stroke="#78716c" fontSize={12} />
          <YAxis stroke="#78716c" />
          <Tooltip
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #fbbf24', borderRadius: '8px' }}
            labelStyle={{ color: '#1c1917' }}
          />
          <Bar dataKey="value" fill="#fbbf24" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChannelPerformanceSection({ channels }: { channels: ChannelPerformance[] }) {
  if (!channels.length) return null;

  return (
    <div className="bg-white border border-amber-200/80 rounded-2xl p-6 shadow-sm">
      <h3 className="text-xl font-bold text-stone-900 mb-4">Channel Performance</h3>
      <div className="space-y-4">
        {channels.map((channel) => (
          <div key={channel.channel} className="border border-stone-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-stone-900">{channel.channel}</h4>
              <span className="text-sm text-stone-600">Sent: {channel.sent}</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-stone-500">Delivery Rate</p>
                <p className="font-semibold text-stone-900">{Math.round(channel.deliveryRate)}%</p>
              </div>
              <div>
                <p className="text-stone-500">Read Rate</p>
                <p className="font-semibold text-stone-900">{Math.round(channel.readRate)}%</p>
              </div>
              <div>
                <p className="text-stone-500">Click Rate</p>
                <p className="font-semibold text-stone-900">{Math.round(channel.clickRate)}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OpportunityDistributionSection({ distribution }: { distribution: OpportunityDistribution[] }) {
  if (!distribution.length) return null;

  const COLORS = ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a'];

  return (
    <div className="bg-white border border-amber-200/80 rounded-2xl p-6 shadow-sm">
      <h3 className="text-xl font-bold text-stone-900 mb-4">Opportunity Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={distribution}
            dataKey="potentialRevenue"
            nameKey="opportunityType"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={(entry) => entry.opportunityType}
          >
            {distribution.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #fbbf24', borderRadius: '8px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function OpportunityTrendSection({ trend }: { trend: OpportunityTrendPoint[] }) {
  if (!trend.length) return null;

  return (
    <div className="bg-white border border-amber-200/80 rounded-2xl p-6 shadow-sm">
      <h3 className="text-xl font-bold text-stone-900 mb-4">Opportunity Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={trend}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis dataKey="date" stroke="#78716c" />
          <YAxis stroke="#78716c" />
          <Tooltip
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #fbbf24', borderRadius: '8px' }}
            labelStyle={{ color: '#1c1917' }}
          />
          <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ActivityFeedSection({ feed }: { feed: ActivityFeedItem[] }) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'opportunity_detected': return '🎯';
      case 'campaign_launched': return '🚀';
      case 'campaign_completed': return '✅';
      case 'customer_analyzed': return '💬';
      default: return '📊';
    }
  };

  return (
    <div className="bg-white border border-amber-200/80 rounded-2xl p-6 shadow-sm">
      <h3 className="text-xl font-bold text-stone-900 mb-4">Agent Activity Feed</h3>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {feed.map((item) => (
          <div key={item.id} className="flex items-start gap-3 pb-3 border-b border-stone-100 last:border-0">
            <span className="text-2xl">{getIcon(item.type)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-stone-700">{item.message}</p>
              <p className="text-xs text-amber-600 mt-1">{new Date(item.timestamp).toLocaleTimeString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIAnalystSection({ query, setQuery }: { query: string; setQuery: (q: string) => void }) {
  const suggestedQuestions = [
    'Why did WhatsApp outperform Email?',
    'Which opportunity should I launch next?',
    'Show me high-value dormant customers',
    'What caused the delivery failures?',
  ];

  return (
    <div className="bg-white border border-amber-200/80 rounded-2xl p-6 shadow-sm">
      <h3 className="text-xl font-bold text-stone-900 mb-4">AI Growth Analyst</h3>
      <div className="space-y-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything about your growth data..."
          className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-900"
        />
        <div>
          <p className="text-sm text-stone-600 mb-2">Suggested questions:</p>
          <div className="space-y-2">
            {suggestedQuestions.map((question, i) => (
              <button
                key={i}
                onClick={() => setQuery(question)}
                className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-amber-50 rounded-lg transition"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
        {query && (
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
            <p className="text-sm text-stone-600">✨ AI is analyzing your question...</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RecommendedActionsSection({ actions }: { actions: RecommendedAction[] }) {
  if (!actions.length) return null;

  return (
    <div className="bg-white border border-amber-200/80 rounded-2xl p-6 shadow-sm">
      <h3 className="text-xl font-bold text-stone-900 mb-4">Recommended Next Actions</h3>
      <div className="space-y-3">
        {actions.map((action, index) => (
          <div key={index} className="border border-stone-200 rounded-lg p-4 hover:border-amber-300 transition">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-sm font-semibold">
                    {index + 1}
                  </span>
                  <h4 className="font-semibold text-stone-900">{action.action}</h4>
                </div>
                <p className="text-sm text-stone-600">Target {action.audience}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-stone-500">Potential Revenue</p>
                <p className="text-lg font-bold text-stone-900">
                  ₹{Math.round(action.potentialRevenue).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

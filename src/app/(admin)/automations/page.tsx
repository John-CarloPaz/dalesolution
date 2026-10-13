'use client';

import { useState } from 'react';
import { Zap, Clock, AlertTriangle, FileText, Mail, Webhook, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

interface Automation {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  category: 'alerts' | 'reports' | 'webhooks';
}

const AUTOMATIONS: Automation[] = [
  {
    id: 'missed-checkin',
    name: 'Missed Check-In Alert',
    description: 'Notify admins when a scheduled employee has not checked in within the configured time window',
    icon: <AlertTriangle className="h-5 w-5" />,
    enabled: true,
    category: 'alerts',
  },
  {
    id: 'late-arrival',
    name: 'Late Arrival Notification',
    description: 'Create an attendance exception and notify the manager when an employee arrives late',
    icon: <Clock className="h-5 w-5" />,
    enabled: true,
    category: 'alerts',
  },
  {
    id: 'missed-clockout',
    name: 'Missed Clock-Out Reminder',
    description: 'Remind employees and escalate when a shift exceeds the maximum duration without a clock-out',
    icon: <AlertTriangle className="h-5 w-5" />,
    enabled: true,
    category: 'alerts',
  },
  {
    id: 'daily-summary',
    name: 'Daily Attendance Summary',
    description: 'Generate and send a daily attendance summary to authorized administrators',
    icon: <FileText className="h-5 w-5" />,
    enabled: false,
    category: 'reports',
  },
  {
    id: 'weekly-report',
    name: 'Weekly Attendance Report',
    description: 'Generate a comprehensive weekly report with attendance statistics and team comparisons',
    icon: <Mail className="h-5 w-5" />,
    enabled: false,
    category: 'reports',
  },
  {
    id: 'onboarding',
    name: 'Employee Onboarding',
    description: 'Trigger onboarding workflows when a new employee accepts their invitation',
    icon: <CheckCircle2 className="h-5 w-5" />,
    enabled: true,
    category: 'webhooks',
  },
];

const WEBHOOK_EVENTS = [
  'employee.invited',
  'employee.activated',
  'attendance.clocked_in',
  'attendance.clocked_out',
  'attendance.break_started',
  'attendance.break_ended',
  'attendance.exception_created',
  'attendance.correction_requested',
  'attendance.correction_reviewed',
];

export default function AutomationsPage() {
  const [automations, setAutomations] = useState(AUTOMATIONS);

  function toggleAutomation(id: string) {
    setAutomations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Automations</h1>
        <p className="text-muted-foreground text-sm">
          Configure automated workflows and integrations
        </p>
      </div>

      <Tabs defaultValue="alerts">
        <TabsList>
          <TabsTrigger value="alerts"><AlertTriangle className="h-3.5 w-3.5 mr-1.5" />Alerts</TabsTrigger>
          <TabsTrigger value="reports"><FileText className="h-3.5 w-3.5 mr-1.5" />Reports</TabsTrigger>
          <TabsTrigger value="webhooks"><Webhook className="h-3.5 w-3.5 mr-1.5" />Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="mt-6 space-y-4">
          {automations
            .filter((a) => a.category === 'alerts')
            .map((automation) => (
              <AutomationCard
                key={automation.id}
                automation={automation}
                onToggle={() => toggleAutomation(automation.id)}
              />
            ))}
        </TabsContent>

        <TabsContent value="reports" className="mt-6 space-y-4">
          {automations
            .filter((a) => a.category === 'reports')
            .map((automation) => (
              <AutomationCard
                key={automation.id}
                automation={automation}
                onToggle={() => toggleAutomation(automation.id)}
              />
            ))}
        </TabsContent>

        <TabsContent value="webhooks" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Webhook Events</CardTitle>
              <CardDescription>
                Configure webhook endpoints to receive real-time events. Integrate with n8n or other automation platforms.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {WEBHOOK_EVENTS.map((event) => (
                  <div key={event} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                      <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{event}</code>
                    </div>
                    <Badge variant="outline" className="text-xs">Available</Badge>
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
              <Button variant="outline">Configure Webhook Endpoints</Button>
            </CardContent>
          </Card>

          {automations
            .filter((a) => a.category === 'webhooks')
            .map((automation) => (
              <AutomationCard
                key={automation.id}
                automation={automation}
                onToggle={() => toggleAutomation(automation.id)}
              />
            ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AutomationCard({
  automation,
  onToggle,
}: {
  automation: Automation;
  onToggle: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-4">
        <div className={`p-2 rounded-lg ${automation.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
          {automation.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm">{automation.name}</h3>
            <Badge variant={automation.enabled ? 'default' : 'secondary'} className="text-xs">
              {automation.enabled ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{automation.description}</p>
        </div>
        <Switch checked={automation.enabled} onCheckedChange={onToggle} />
      </CardContent>
    </Card>
  );
}

import { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Wifi, Plus } from 'lucide-react';
import { GatewayFormDialog } from './GatewayFormDialog';

/**
 * Shown when no Gateways are configured yet. Never renders a broken
 * dashboard full of failed requests - onboarding first.
 */
export function GatewayOnboarding() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg border-border bg-card">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="rounded-full bg-muted p-3">
              <Wifi className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <CardTitle className="text-xl">Welcome</CardTitle>
          <CardDescription>
            No Gateways are configured. Add a Gateway to begin using the API application.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button onClick={() => setDialogOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Gateway
          </Button>
        </CardContent>
      </Card>

      <GatewayFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

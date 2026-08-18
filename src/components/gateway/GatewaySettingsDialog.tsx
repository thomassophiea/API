import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { GatewayManager } from './GatewayManager';

interface GatewaySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GatewaySettingsDialog({ open, onOpenChange }: GatewaySettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gateway Settings</DialogTitle>
        </DialogHeader>
        <GatewayManager />
      </DialogContent>
    </Dialog>
  );
}

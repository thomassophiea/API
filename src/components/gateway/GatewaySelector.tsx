import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { ChevronDown, Wifi, Settings } from 'lucide-react';
import { useGateway } from '../../contexts/GatewayContext';

interface GatewaySelectorProps {
  onManageGateways: () => void;
}

/** Persistent Gateway context indicator + switcher for the app shell/header. */
export function GatewaySelector({ onManageGateways }: GatewaySelectorProps) {
  const { gateways, activeGateway, selectGateway } = useGateway();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2 max-w-[240px]">
          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${activeGateway ? 'bg-green-500' : 'bg-red-500'}`} />
          <Wifi className="h-4 w-4 flex-shrink-0" />
          <span className="truncate text-xs">
            {activeGateway ? `${activeGateway.name} (${activeGateway.host})` : 'No Gateway selected'}
          </span>
          <ChevronDown className="h-3 w-3 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Gateway</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {gateways.map((g) => (
          <DropdownMenuItem key={g.id} onClick={() => selectGateway(g.id)} className="flex items-center justify-between">
            <span className="flex items-center gap-2 truncate">
              <span className={`h-2 w-2 rounded-full flex-shrink-0 ${g.id === activeGateway?.id ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
              <span className="truncate">{g.name}</span>
            </span>
            <span className="text-xs text-muted-foreground font-mono">{g.host}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onManageGateways} className="flex items-center gap-2">
          <Settings className="h-4 w-4" /> Manage Gateways
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

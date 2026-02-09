import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1>{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Construction className="h-5 w-5" />
            <span>Coming Soon</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This section will be implemented as we add functionality piece by piece. 
            For now, you can use the API Test Tool to explore the available endpoints 
            and test the API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
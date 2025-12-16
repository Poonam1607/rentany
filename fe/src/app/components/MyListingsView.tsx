import { Edit, Trash2, Eye, Clock, CheckCircle } from 'lucide-react';
import { RentalItem } from '../types';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { toast } from 'sonner';

interface MyListingsViewProps {
  items: RentalItem[];
  userId: string;
}

export function MyListingsView({ items, userId }: MyListingsViewProps) {
  const myItems = items.filter((item) => item.ownerId === userId);

  const handleToggleAvailability = (itemId: string) => {
    toast.success('Item availability updated');
  };

  const handleEdit = (itemId: string) => {
    toast.info('Edit functionality coming soon');
  };

  const handleDelete = (itemId: string) => {
    toast.success('Item removed from listings');
  };

  if (myItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold mb-4">No Listings Yet</h2>
          <p className="text-gray-600 mb-6">
            Start earning by listing items you're not using. From tools to equipment, turn your idle assets into income.
          </p>
          <Button size="lg">List Your First Item</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Listings</h1>
        <p className="text-gray-600">Manage your rental items</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {myItems.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Image */}
                <div className="w-full md:w-48 h-48 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  <ImageWithFallback
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 space-y-4">
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-xl font-semibold mb-1">{item.title}</h3>
                        <Badge className="mb-2">{item.category}</Badge>
                      </div>
                      <Badge
                        variant={item.availability ? 'default' : 'secondary'}
                        className="ml-2"
                      >
                        {item.availability ? 'Available' : 'Unavailable'}
                      </Badge>
                    </div>
                    <p className="text-gray-600">{item.description}</p>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="font-semibold text-blue-600">
                        ${item.hourlyRate}/hour
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">42 views</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600 capitalize">{item.condition} condition</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      variant={item.availability ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => handleToggleAvailability(item.id)}
                    >
                      {item.availability ? 'Mark Unavailable' : 'Mark Available'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(item.id)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(item.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

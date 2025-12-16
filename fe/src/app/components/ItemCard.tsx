import { MapPin, Star, Clock } from 'lucide-react';
import { RentalItem } from '../types';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface ItemCardProps {
  item: RentalItem;
  onClick: () => void;
}

export function ItemCard({ item, onClick }: ItemCardProps) {
  return (
    <Card
      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="relative h-48 w-full bg-gray-100">
        <ImageWithFallback
          src={item.imageUrl}
          alt={item.title}
          className="w-full h-full object-cover"
        />
        <Badge className="absolute top-2 right-2 bg-white text-gray-900">
          {item.category}
        </Badge>
      </div>

      <CardContent className="p-4">
        <h3 className="font-semibold text-lg mb-1 line-clamp-1">{item.title}</h3>
        
        <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
          <MapPin className="w-4 h-4" />
          <span>{item.location}</span>
          {item.distance && (
            <span className="text-gray-400">• {item.distance} mi</span>
          )}
        </div>

        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{item.description}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium">{item.ownerRating}</span>
            </div>
            <span className="text-sm text-gray-500">{item.ownerName}</span>
          </div>
          
          <div className="flex items-center gap-1 font-semibold text-blue-600">
            <Clock className="w-4 h-4" />
            <span>${item.hourlyRate}/hr</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <Badge variant={item.availability ? 'default' : 'secondary'}>
            {item.availability ? 'Available' : 'Unavailable'}
          </Badge>
          <span className="text-xs text-gray-500 capitalize">
            {item.condition} condition
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

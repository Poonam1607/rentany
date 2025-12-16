import { useState } from 'react';
import { MapPin, Star, Clock, Calendar as CalendarIcon, User, Shield } from 'lucide-react';
import { RentalItem } from '../types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Label } from './ui/label';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { toast } from 'sonner';

interface ItemDetailModalProps {
  item: RentalItem | null;
  isOpen: boolean;
  onClose: () => void;
  onBooking: (itemId: string, startTime: Date, endTime: Date) => void;
}

export function ItemDetailModal({ item, isOpen, onClose, onBooking }: ItemDetailModalProps) {
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');

  if (!item) return null;

  const handleBooking = () => {
    if (!startDate || !startTime || !endDate || !endTime) {
      toast.error('Please fill in all booking details');
      return;
    }

    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);

    if (start >= end) {
      toast.error('End time must be after start time');
      return;
    }

    const hours = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60));
    const totalCost = hours * item.hourlyRate;

    onBooking(item.id, start, end);
    toast.success(`Booking confirmed! Total: $${totalCost} for ${hours} hours`);
    
    // Reset form
    setStartDate('');
    setStartTime('');
    setEndDate('');
    setEndTime('');
  };

  const calculateTotal = () => {
    if (!startDate || !startTime || !endDate || !endTime) return null;

    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);

    if (start >= end) return null;

    const hours = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60));
    return { hours, total: hours * item.hourlyRate };
  };

  const totals = calculateTotal();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.title}</DialogTitle>
          <DialogDescription>
            <Badge className="mt-2">{item.category}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Image */}
          <div className="relative h-64 w-full bg-gray-100 rounded-lg overflow-hidden">
            <ImageWithFallback
              src={item.imageUrl}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Pricing */}
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="text-2xl font-bold text-blue-600">
                ${item.hourlyRate}/hour
              </span>
            </div>
            <Badge variant={item.availability ? 'default' : 'secondary'}>
              {item.availability ? 'Available' : 'Unavailable'}
            </Badge>
          </div>

          {/* Description */}
          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-gray-600">{item.description}</p>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Location</h3>
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-4 h-4" />
                <span>{item.location}</span>
              </div>
              {item.distance && (
                <p className="text-sm text-gray-500 ml-6">{item.distance} miles away</p>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-2">Condition</h3>
              <p className="text-gray-600 capitalize">{item.condition}</p>
            </div>
          </div>

          {/* Owner Info */}
          <div>
            <h3 className="font-semibold mb-2">Owner</h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <p className="font-medium">{item.ownerName}</p>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm">{item.ownerRating} rating</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Booking Section */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Book This Item
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <input
                    type="date"
                    id="start-date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <Label htmlFor="start-time">Start Time</Label>
                  <input
                    type="time"
                    id="start-time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <input
                    type="date"
                    id="end-date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || new Date().toISOString().split('T')[0]}
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <Label htmlFor="end-time">End Time</Label>
                  <input
                    type="time"
                    id="end-time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                  />
                </div>
              </div>

              {totals && (
                <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium">{totals.hours} hours</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Hourly Rate:</span>
                    <span className="font-medium">${item.hourlyRate}/hr</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg">
                    <span className="font-semibold">Total Cost:</span>
                    <span className="font-bold text-blue-600">${totals.total}</span>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-600">
                  Your booking is protected. Payment is held securely until the rental is completed.
                </p>
              </div>

              <Button
                onClick={handleBooking}
                disabled={!item.availability}
                className="w-full"
                size="lg"
              >
                {item.availability ? 'Confirm Booking' : 'Item Not Available'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
